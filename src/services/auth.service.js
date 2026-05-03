// service 负责处理业务逻辑
// 1. 注册用户
// 2. 登录用户

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../env.js";
import { User } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";

function normalizeCredentials(username, password) {
  return {
    username: String(username ?? "").trim(),
    password: String(password ?? "").trim(),
  };
}

export async function registerUser(payload) {
  const { username, password } = normalizeCredentials(payload.username, payload.password);

  if (!username || !password) {
    throw createHttpError(400, "用户名或密码不能为空");
  }

  const hashPwd = await bcrypt.hash(password, 10);
  await User.create({ username, password: hashPwd });
}

export async function loginUser(payload) {
  const { username, password } = normalizeCredentials(payload.username, payload.password);

  if (!username || !password) {
    throw createHttpError(400, "用户名或密码不能为空");
  }

  const user = await User.findOne({ where: { username } });
  const credentialOk = user ? await bcrypt.compare(password, user.password) : false;

  if (!credentialOk) {
    throw createHttpError(401, "用户名或密码错误");
  }

  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "7d",
  });
}
