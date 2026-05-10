import {
  findPortalUsersPage,
  removePortalUserById,
  updatePortalUserById,
} from "../services/adminPortalUser.service.js";
import { getValidated } from "../utils/getValidated.js";
import { success } from "../utils/response.js";

import type {
  ValidatedAdminPortalUserDeleteSchema,
  ValidatedAdminPortalUserPatchSchema,
  ValidatedAdminPortalUsersListSchema,
} from "../schema/admin.schema.js";
import type { Request, Response } from "express";
import type { Model } from "sequelize";

export async function listPortalUsers(req: Request, res: Response) {
  const { query } = getValidated<ValidatedAdminPortalUsersListSchema>(req);
  const { page, limit, q } = query;
  const { users, total, totalPages } = await findPortalUsersPage(page, limit, q);
  const hasNext = totalPages > 0 && page < totalPages;
  const rows = users.map((u: Model) => u.get({ plain: true }) as Record<string, unknown>);
  return success(res, "获取注册用户列表成功", {
    users: rows,
    pagination: { page, limit, total, totalPages, hasNext },
  });
}

export async function patchPortalUser(req: Request, res: Response) {
  const { params, body } = getValidated<ValidatedAdminPortalUserPatchSchema>(req);
  const user = await updatePortalUserById(params.id, body);
  return success(res, "更新用户成功", { user: user?.get({ plain: true }) });
}

export async function deletePortalUser(req: Request, res: Response) {
  const { params } = getValidated<ValidatedAdminPortalUserDeleteSchema>(req);
  await removePortalUserById(params.id);
  return success(res, "删除用户成功");
}
