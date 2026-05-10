import {
  createStaffUser,
  findStaffUsersPage,
  listAssignableStaffRoles,
  revokeStaffUser,
  updateStaffUser,
} from "../services/adminStaff.service.js";
import { getValidated } from "../utils/getValidated.js";
import { success } from "../utils/response.js";

import type {
  ValidatedAdminStaffCreateSchema,
  ValidatedAdminStaffDeleteSchema,
  ValidatedAdminStaffListSchema,
  ValidatedAdminStaffPatchSchema,
} from "../schema/admin.schema.js";
import type { Request, Response } from "express";
import type { Model } from "sequelize";

export async function listStaffUsers(req: Request, res: Response) {
  const { query } = getValidated<ValidatedAdminStaffListSchema>(req);
  const { users, total, totalPages } = await findStaffUsersPage(query.page, query.limit, query.q);
  const hasNext = totalPages > 0 && query.page < totalPages;
  return success(res, "获取职员列表成功", {
    users: users.map((u: Model) => u.get({ plain: true }) as Record<string, unknown>),
    pagination: { page: query.page, limit: query.limit, total, totalPages, hasNext },
  });
}

export async function postStaffUser(req: Request, res: Response) {
  const uid = req.user?.id as number;
  const { body } = getValidated<ValidatedAdminStaffCreateSchema>(req);
  const row = await createStaffUser(uid, body);
  return success(res, "创建后台账号成功", { user: row?.get({ plain: true }) });
}

export async function patchStaffUser(req: Request, res: Response) {
  const uid = req.user?.id as number;
  const { params, body } = getValidated<ValidatedAdminStaffPatchSchema>(req);
  const row = await updateStaffUser(uid, params.id, body);
  return success(res, "更新职员成功", { user: row?.get({ plain: true }) });
}

export async function deleteStaffUser(req: Request, res: Response) {
  const uid = req.user?.id as number;
  const { params } = getValidated<ValidatedAdminStaffDeleteSchema>(req);
  await revokeStaffUser(uid, params.id);
  return success(res, "已撤销后台身份");
}

export async function getStaffRoleCatalog(_req: Request, res: Response) {
  const roles = await listAssignableStaffRoles();
  return success(res, "可绑定后台角色", { roles });
}
