import { findAllUsers, findUserById, removeUser, updateUserById } from "../services/user.service.js";
import { success } from "../utils/response.js";

export async function getUsers(req, res) {
  console.log("req.user111111>>>", req.user);
  const users = await findAllUsers();
  return success(res, "获取用户列表成功", { users });
}

export async function getUserById(req, res) {
  const user = await findUserById(req.params.id);
  return success(res, "获取用户成功", { user });
}

export async function getOneUser(req, res) {
  const user = await findUserById(req.query.id);
  return success(res, "获取用户成功", { user });
}

export async function deleteUser(req, res) {
  await removeUser(req.params.id);
  return success(res, "删除用户成功");
}

export async function updateUser(req, res) {
  await updateUserById(req.params.id, req.body);
  return success(res, "更新用户成功");
}
