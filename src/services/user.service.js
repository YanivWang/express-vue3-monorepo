// service 负责处理业务逻辑
// 1. 获取用户列表
// 2. 获取用户详情
// 3. 更新用户
// 4. 删除用户

import bcrypt from "bcrypt";
import { User } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";

async function findUserOrThrow(id) {
  const user = await User.findByPk(id);

  // 业务错误，直接 throw 出去，让全局错误处理中间件处理
  if (!user) {
    throw createHttpError(404, "用户不存在");
  }

  return user;
}

export async function findAllUsers() {
  return User.findAll();
}

export async function findUserById(id) {
  return findUserOrThrow(id);
}

export async function removeUser(id) {
  const user = await findUserOrThrow(id);
  await user.destroy();
}

export async function updateUserById(id, payload) {
  const user = await findUserOrThrow(id);
  const username = String(payload.username ?? "").trim();
  const password = String(payload.password ?? "").trim();

  //基本上每个controller或者service层都要进行参数校验，业务逻辑中混入很多校验代码
  // services 层手动进行参数检验
  if (!username || !password) {
    throw createHttpError(400, "用户名或密码不能为空");
  }

  const hashPwd = await bcrypt.hash(password, 10);
  await user.update({ username, password: hashPwd });
}
