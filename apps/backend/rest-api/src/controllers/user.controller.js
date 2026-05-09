import {
  findUsersPage,
  findUserById,
  removeUser,
  updateUserById,
} from "../services/user.service.js";
import { success } from "../utils/response.js";

export async function getUsers(req, res) {
  //从请求查询参数中取出被 getUsersSchema 校验(清洗)过的 page 和 limit
  const { page, limit } = req.query;
  const { users, total, totalPages } = await findUsersPage(page, limit);
  const hasNext = totalPages > 0 && page < totalPages;
  return success(res, "获取用户列表成功", {
    users,
    pagination: { page, limit, total, totalPages, hasNext },
  });
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
