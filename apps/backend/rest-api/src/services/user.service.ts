// service 负责处理业务逻辑
// 1. 获取用户列表
// 2. 获取用户详情
// 3. 更新用户
// 4. 删除用户

import bcrypt from "bcrypt";

import { User } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";
import { trimmedStringFromUnknown } from "../utils/trimmedStringFromUnknown.js";

async function findUserOrThrow(id: number) {
  const user = await User.findByPk(id);

  if (!user) {
    throw createHttpError(404, "用户不存在");
  }

  return user;
}

export async function findUsersPage(page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.findAll({
      limit,
      offset,
      order: [["id", "ASC"]],
    }),
    User.count(),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { users, total, totalPages };
}

export async function findUserById(id: number) {
  return findUserOrThrow(id);
}

export async function removeUser(id: number) {
  const user = await findUserOrThrow(id);
  await user.destroy();
}

export async function updateUserById(
  id: number,
  payload: { username?: unknown; password?: unknown },
) {
  const user = await findUserOrThrow(id);
  const username = trimmedStringFromUnknown(payload.username);
  const password = trimmedStringFromUnknown(payload.password);

  if (!username || !password) {
    throw createHttpError(400, "用户名或密码不能为空");
  }

  const hashPwd = await bcrypt.hash(password, 10);
  await user.update({ username, password: hashPwd });
}
