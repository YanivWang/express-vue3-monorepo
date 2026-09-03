import { randomUUID } from "node:crypto";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { Role, User } from "../db.js";
import { ACCESS_TOKEN_TTL_SECONDS, JWT_SECRET } from "../env.js";
import { createHttpError } from "../middlewares/error.middleware.js";
import { ROLE_SLUG_USER } from "../rbac/permission-codes.js";
import { logger } from "../utils/logger.js";
import { trimmedStringFromUnknown } from "../utils/trimmedStringFromUnknown.js";

import { getRoleIdBySlugOrThrow } from "./rbac.service.js";

/**
 * 用户名不存在时用来比对的占位哈希（cost 与真实口令一致，故耗时也一致）。
 * 值本身无意义：它是一段随机口令的哈希，任何真实输入都不会匹配。
 */
const DUMMY_PASSWORD_HASH = "$2b$10$kePvKnXiy3wRv8s53wbJBu.zaI/CSQ3p1/WMBOqoTrzVvD9Elx/9O";

function normalizeCredentials(username: unknown, password: unknown) {
  return {
    username: trimmedStringFromUnknown(username),
    password: trimmedStringFromUnknown(password),
  };
}

export async function registerUser(payload: { username?: unknown; password?: unknown }) {
  const { username, password } = normalizeCredentials(payload.username, payload.password);

  if (!username || !password) {
    throw createHttpError(400, "用户名或密码不能为空");
  }

  const hashPwd = await bcrypt.hash(password, 10);
  const roleId = await getRoleIdBySlugOrThrow(ROLE_SLUG_USER);
  await User.create({ username, password: hashPwd, roleId });

  logger.info("register_user", { username });
}

/** 访问令牌：短时效 JWT，随 Authorization 头发送，前端只在内存中保存 */
export function signAccessToken(user: {
  id: number;
  username: string;
  roleId?: number;
  roleSlug: string;
}): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      roleId: user.roleId,
      roleSlug: user.roleSlug,
    },
    JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      // 每份令牌一个全局唯一 id，登出时据此拉黑
      jwtid: randomUUID(),
    },
  );
}

/** 登录成功后签发访问令牌所需的身份信息 */
export interface AuthenticatedIdentity {
  id: number;
  username: string;
  roleId?: number;
  roleSlug: string;
}

async function loadIdentityById(userId: number): Promise<AuthenticatedIdentity | null> {
  const user = await User.findByPk(userId, {
    include: [{ model: Role, as: "role", attributes: ["id", "slug"] }],
  });
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    roleId: user.roleId,
    roleSlug: user.role?.slug ?? "",
  };
}

/** 刷新时重新读取身份：角色可能在两次刷新之间被改动，不能直接沿用旧令牌里的冗余字段 */
export async function requireIdentityById(userId: number): Promise<AuthenticatedIdentity> {
  const identity = await loadIdentityById(userId);
  if (!identity) {
    throw createHttpError(401, "登录已失效，请重新登录");
  }
  return identity;
}

export async function loginUser(payload: {
  username?: unknown;
  password?: unknown;
}): Promise<AuthenticatedIdentity> {
  const { username, password } = normalizeCredentials(payload.username, payload.password);

  if (!username || !password) {
    throw createHttpError(400, "用户名或密码不能为空");
  }

  const user = await User.findOne({
    where: { username },
    include: [{ model: Role, as: "role", attributes: ["id", "slug"] }],
  });

  /**
   * 用户不存在时也走一次 bcrypt：否则「查无此人」会明显快于「密码错误」，
   * 攻击者据此就能按响应时间枚举出哪些用户名是真的。
   *
   * 注意这只堵住了时序这一条：`POST /api/register` 目前仍会对重名返回 409「用户名已存在」，
   * 那是更直白的枚举入口，但它同时也是注册表单的正常交互。要不要一并收敛，
   * 属于产品取舍，不在本次改动范围内。
   */
  const credentialOk = await bcrypt.compare(password, user ? user.password : DUMMY_PASSWORD_HASH);

  if (!credentialOk || !user) {
    throw createHttpError(401, "用户名或密码错误");
  }

  // include 命中时 role 存在；UserModel 已声明其类型，无需再做结构化窄化
  return {
    id: user.id,
    username: user.username,
    roleId: user.roleId,
    roleSlug: user.role?.slug ?? "",
  };
}
