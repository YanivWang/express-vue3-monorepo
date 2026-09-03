import {
  SESSION_HINT_COOKIE_NAME,
  SESSION_HINT_COOKIE_VALUE,
} from "@express-vue3-monorepo/shared/constants";

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

/**
 * 会话标记：与刷新令牌 Cookie 同生共死的一枚 **JS 可读** 标记位（用途见 shared/constants/auth.ts）。
 *
 * 三点与刷新 Cookie 刻意不同：
 * - `httpOnly: false` —— 它就是给前端 JS 读的，这是它存在的全部意义；
 * - `path: "/"` —— `document.cookie` 只能读到覆盖当前路径的 Cookie，
 *   跟着刷新 Cookie 设成 `/api` 的话前端在 `/` 上根本读不到；
 * - 值恒为 `1`，不含任何身份信息 —— 它不是凭证，伪造它只能让自己多发一次注定 401 的刷新。
 *
 * 其余属性（secure / sameSite）与刷新 Cookie 保持一致，避免两者在某些部署下一个存活一个被丢，
 * 那会退化成「标记说有会话、实际没有」的空转，或者反过来永远恢复不了会话。
 */
function setSessionHintCookie(req: Request, res: Response, maxAgeSeconds: number) {
  res.cookie(SESSION_HINT_COOKIE_NAME, SESSION_HINT_COOKIE_VALUE, {
    httpOnly: false,
    secure: resolveAuthCookieSecure(req),
    sameSite: "strict",
    path: "/",
    maxAge: maxAgeSeconds * 1000,
  });
}

function clearSessionHintCookie(req: Request, res: Response) {
  res.clearCookie(SESSION_HINT_COOKIE_NAME, {
    httpOnly: false,
    secure: resolveAuthCookieSecure(req),
    sameSite: "strict",
    path: "/",
  });
}

/** 两枚 Cookie 必须成对写、成对清，否则前端的「有没有会话」判断就会和服务端脱节 */
function setSessionCookies(req: Request, res: Response, token: string, maxAgeSeconds: number) {
  setRefreshCookie(req, res, token, maxAgeSeconds);
  setSessionHintCookie(req, res, maxAgeSeconds);
}

function clearSessionCookies(req: Request, res: Response) {
  clearRefreshCookie(req, res);
  clearSessionHintCookie(req, res);
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
  setSessionCookies(req, res, refresh.token, refresh.expiresInSeconds);

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
    clearSessionCookies(req, res);
    throw createHttpError(401, "登录凭证异常，已出于安全考虑登出，请重新登录");
  }

  if (outcome.status === "invalid") {
    clearSessionCookies(req, res);
    throw createHttpError(401, "刷新凭证无效或已过期，请重新登录");
  }

  // 角色可能在两次刷新之间被管理员改动，故重新读库而不是沿用旧令牌里的冗余字段
  const identity = await requireIdentityById(outcome.userId);

  setSessionCookies(req, res, outcome.next.token, outcome.next.expiresInSeconds);
  return success(res, "刷新成功", {
    token: signAccessToken(identity),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

/**
 * 登出。**幂等，且不要求一枚还没过期的访问令牌**（理由见 auth.routes.ts 的挂载说明）。
 *
 * 会话真正的锚点是 Cookie 里那枚刷新令牌：撤销它所属的整个家族，会话才算结束。
 * Bearer 是可选的加分项——带了就顺手把这枚访问令牌的 jti 拉黑，让它剩余的有效期也失效；
 * 没带（已过期、已被拉黑、或者根本是个直连脚本）就跳过这一步，绝不因此让撤销落空。
 *
 * 什么都没带的调用同样返回成功：登出的语义是「让我处于未登录状态」，
 * 而这个状态已经达成了。回 401 只会让客户端以为「没退成功」而重试，没有任何收益。
 */
export async function logout(req: Request, res: Response) {
  const user = req.user;
  const jti = user?.jti;
  const exp = user?.exp;

  // 访问令牌是 JWT、无法撤回，只能在剩余有效期内拉黑
  if (jti && exp) {
    const ttlSeconds = exp - Math.floor(Date.now() / 1000);
    if (ttlSeconds > 0) {
      await blacklistJwt(jti, ttlSeconds);
    }
  }

  // 刷新令牌可以真正撤销：连同同一次登录派生出的整个家族一起作废
  const raw = readCookie(req, REFRESH_COOKIE_NAME);
  if (raw) {
    await revokeRefreshTokenByRaw(raw);
  }
  clearSessionCookies(req, res);

  return success(res, "退出登录成功");
}
