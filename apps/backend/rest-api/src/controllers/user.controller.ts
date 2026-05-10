import {
  findUsersPage,
  findUserById,
  removeUser,
  updateUserById,
} from "../services/user.service.js";
import { getValidated } from "../utils/getValidated.js";
import { success } from "../utils/response.js";

import type {
  ValidatedDeleteUserSchema,
  ValidatedGetOneUserSchema,
  ValidatedGetUserSchema,
  ValidatedGetUsersSchema,
  ValidatedUpdateUserSchema,
} from "../schema/user.schema.js";
import type { Request, Response } from "express";

export async function getUsers(req: Request, res: Response) {
  const { query } = getValidated<ValidatedGetUsersSchema>(req);
  const { page, limit } = query;
  const { users, total, totalPages } = await findUsersPage(page, limit);
  const hasNext = totalPages > 0 && page < totalPages;
  return success(res, "获取用户列表成功", {
    users,
    pagination: { page, limit, total, totalPages, hasNext },
  });
}

export async function getUserById(req: Request, res: Response) {
  const { params } = getValidated<ValidatedGetUserSchema>(req);
  const user = await findUserById(params.id);
  return success(res, "获取用户成功", { user });
}

export async function getOneUser(req: Request, res: Response) {
  const { query } = getValidated<ValidatedGetOneUserSchema>(req);
  const user = await findUserById(query.id);
  return success(res, "获取用户成功", { user });
}

export async function deleteUser(req: Request, res: Response) {
  const { params } = getValidated<ValidatedDeleteUserSchema>(req);
  await removeUser(params.id);
  return success(res, "删除用户成功");
}

export async function updateUser(req: Request, res: Response) {
  const { params, body } = getValidated<ValidatedUpdateUserSchema>(req);
  await updateUserById(params.id, body);
  return success(res, "更新用户成功");
}
