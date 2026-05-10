import {
  createCustomRole,
  findAllPermissions,
  findRolesDetailed,
  removeRoleById,
  updateRoleById,
} from "../services/adminRole.service.js";
import { getValidated } from "../utils/getValidated.js";
import { success } from "../utils/response.js";

import type {
  ValidatedAdminRolesCreateSchema,
  ValidatedAdminRolesDeleteSchema,
  ValidatedAdminRolesPatchSchema,
} from "../schema/admin.schema.js";
import type { Request, Response } from "express";
import type { Model } from "sequelize";

export async function listPermissions(_req: Request, res: Response) {
  const permissions = await findAllPermissions();
  return success(res, "权限列表成功", {
    permissions: permissions.map((p: Model) => p.get({ plain: true }) as Record<string, unknown>),
  });
}

export async function listRoles(_req: Request, res: Response) {
  const roles = await findRolesDetailed();
  return success(res, "角色列表成功", { roles });
}

export async function postRole(req: Request, res: Response) {
  const { body } = getValidated<ValidatedAdminRolesCreateSchema>(req);
  const row = await createCustomRole(body);
  return success(res, "创建角色成功", { role: row?.get({ plain: true }) });
}

export async function patchRole(req: Request, res: Response) {
  const { params, body } = getValidated<ValidatedAdminRolesPatchSchema>(req);
  const row = await updateRoleById(params.id, body);
  return success(res, "更新角色成功", { role: row?.get({ plain: true }) });
}

export async function deleteRole(req: Request, res: Response) {
  const { params } = getValidated<ValidatedAdminRolesDeleteSchema>(req);
  await removeRoleById(params.id);
  return success(res, "删除角色成功");
}
