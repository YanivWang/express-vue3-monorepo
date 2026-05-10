import {
  findUsersPage,
  findUserById,
  removeUser,
  updateUserById,
} from "../services/user.service.js";
import { success } from "../utils/response.js";

import type { Request, Response } from "express";

export async function getUsers(req: Request, res: Response) {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { users, total, totalPages } = await findUsersPage(page, limit);
  const hasNext = totalPages > 0 && page < totalPages;
  return success(res, "获取用户列表成功", {
    users,
    pagination: { page, limit, total, totalPages, hasNext },
  });
}

export async function getUserById(req: Request, res: Response) {
  const user = await findUserById(Number(req.params.id));
  return success(res, "获取用户成功", { user });
}

export async function getOneUser(req: Request, res: Response) {
  const user = await findUserById(Number(req.query.id));
  return success(res, "获取用户成功", { user });
}

export async function deleteUser(req: Request, res: Response) {
  await removeUser(Number(req.params.id));
  return success(res, "删除用户成功");
}

export async function updateUser(req: Request, res: Response) {
  await updateUserById(
    Number(req.params.id),
    req.body as { username?: unknown; password?: unknown },
  );
  return success(res, "更新用户成功");
}
