import { randomUUID } from "node:crypto";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { Role, User } from "../db.js";
import { JWT_SECRET } from "../env.js";
import { createHttpError } from "../middlewares/error.middleware.js";
import { ROLE_SLUG_USER } from "../rbac/permission-codes.js";
import { logger } from "../utils/logger.js";
import { trimmedStringFromUnknown } from "../utils/trimmedStringFromUnknown.js";

import { getRoleIdBySlugOrThrow } from "./rbac.service.js";

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

export async function loginUser(payload: { username?: unknown; password?: unknown }) {
  const { username, password } = normalizeCredentials(payload.username, payload.password);

  if (!username || !password) {
    throw createHttpError(400, "用户名或密码不能为空");
  }

  const user = await User.findOne({
    where: { username },
    include: [{ model: Role, as: "role", attributes: ["id", "slug"] }],
  });
  const credentialOk = user ? await bcrypt.compare(password, user.password) : false;

  if (!credentialOk || !user) {
    throw createHttpError(401, "用户名或密码错误");
  }

  // include 命中时 role 存在；UserModel 已声明其类型，无需再做结构化窄化
  const roleSlug = user.role?.slug ?? "";
  const roleId = user.roleId;

  const jti = randomUUID();

  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      roleId: roleId ?? undefined,
      roleSlug,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
      jwtid: jti, // 给每一份新签发的登录token一个全局唯一的id
    },
  );
}
