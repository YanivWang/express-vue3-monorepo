import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from "../env.js";
import { createHttpError } from "../middlewares/error.middleware.js";
import { blacklistJwt } from "../services/auth-token.service.js";
import {
  loginUser,
  registerUser,
  requireIdentityById,
  signAccessToken,
} from "../services/auth.service.js";
import {
  issueRefreshToken,
  revokeRefreshTokenByRaw,
  rotateRefreshToken,
} from "../services/refresh-token.service.js";
import { readCookie, resolveAuthCookieSecure } from "../utils/cookies.js";
import { getValidated } from "../utils/getValidated.js";
import { success } from "../utils/response.js";

import type { ValidatedLoginSchema, ValidatedRegisterSchema } from "../schema/auth.schema.js";
import type { AppJwtUser } from "../types/jwt-user.js";
import type { Response, Request } from "express";

/**
 * 刷新令牌 Cookie 的安全属性：
 * - httpOnly  —— JS 读不到，XSS 无法直接窃取；
 * - secure    —— 由 AUTH_COOKIE_SECURE 决定，`auto` 时按本次请求是否 HTTPS 逐请求判定
 *                （见 utils/cookies.ts 的 resolveAuthCookieSecure）；
 * - sameSite  —— strict 使跨站请求根本不携带它，刷新接口因此无需额外的 CSRF 令牌；
 * - path      —— 见 env.ts 中 REFRESH_COOKIE_PATH 的取舍说明（登出同样需要读到它）。
 *
 * 清除时必须与写入时的属性一致，否则浏览器会认为是另一枚 Cookie 而留下原值。
 */
function setRefreshCookie(req: Request, res: Response, token: string, maxAgeSeconds: number) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: resolveAuthCookieSecure(req),
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeSeconds * 1000,
  });
}

function clearRefreshCookie(req: Request, res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: resolveAuthCookieSecure(req),
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
  });
}

export async function register(req: Request, res: Response) {
  const { body } = getValidated<ValidatedRegisterSchema>(req);
  await registerUser(body);
  return success(res, "注册成功");
}

export async function login(req: Request, res: Response) {
  const { body } = getValidated<ValidatedLoginSchema>(req);
  const identity = await loginUser(body);

  const refresh = await issueRefreshToken(identity.id);
  setRefreshCookie(req, res, refresh.token, refresh.expiresInSeconds);

  // 字段名保持 `token`，与既有前端及 OpenAPI 契约兼容；新增 expiresIn 供前端安排静默刷新
  return success(res, "登录成功", {
    token: signAccessToken(identity),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

/**
 * 用刷新令牌换一枚新的访问令牌，并轮换刷新令牌本身。
 *
 * 这是唯一依赖 Cookie 认证的接口；SameSite=Strict 保证跨站请求不会携带该 Cookie，
 * 因此不需要再叠加一层 CSRF 令牌。
 */
export async function refresh(req: Request, res: Response) {
  const raw = readCookie(req, REFRESH_COOKIE_NAME);
  if (!raw) {
    throw createHttpError(401, "缺少刷新凭证，请重新登录");
  }

  const outcome = await rotateRefreshToken(raw);

  if (outcome.status === "reused") {
    // 令牌被重放：家族已在 service 内撤销，这里把客户端的 Cookie 一并清掉
    clearRefreshCookie(req, res);
    throw createHttpError(401, "登录凭证异常，已出于安全考虑登出，请重新登录");
  }

  if (outcome.status === "invalid") {
    clearRefreshCookie(req, res);
    throw createHttpError(401, "刷新凭证无效或已过期，请重新登录");
  }

  // 角色可能在两次刷新之间被管理员改动，故重新读库而不是沿用旧令牌里的冗余字段
  const identity = await requireIdentityById(outcome.userId);

  setRefreshCookie(req, res, outcome.next.token, outcome.next.expiresInSeconds);
  return success(res, "刷新成功", {
    token: signAccessToken(identity),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

export async function logout(req: Request, res: Response) {
  const { jti, exp } = req.user as AppJwtUser;
  if (!jti || !exp) {
    throw createHttpError(401, "无效登录凭证");
  }

  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = exp - now;

  // 访问令牌是 JWT、无法撤回，只能在剩余有效期内拉黑
  if (ttlSeconds > 0) {
    await blacklistJwt(jti, ttlSeconds);
  }

  // 刷新令牌可以真正撤销：连同同一次登录派生出的整个家族一起作废
  const raw = readCookie(req, REFRESH_COOKIE_NAME);
  if (raw) {
    await revokeRefreshTokenByRaw(raw);
  }
  clearRefreshCookie(req, res);

  return success(res, "退出登录成功");
}
