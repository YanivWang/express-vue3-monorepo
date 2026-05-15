import { Permission, Role, User } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";
import {
  ROLE_SLUG_MODERATOR,
  ROLE_SLUG_SUPER_ADMIN,
  ROLE_SLUG_USER,
} from "../rbac/permission-codes.js";
import { trimmedStringFromUnknown } from "../utils/trimmedStringFromUnknown.js";

import { clearRbacSnapshotCacheForRole } from "./rbac.service.js";

import type { Model } from "sequelize";

/** 枚举全部权限 definition（前端矩阵） */
export async function findAllPermissions() {
  return Permission.findAll({
    attributes: ["id", "code", "description"],
    order: [["code", "ASC"]],
  });
}

export async function findRolesDetailed() {
  const roles = await Role.findAll({
    order: [["id", "ASC"]],
    include: [
      {
        model: Permission,
        as: "permissions",
        through: { attributes: [] },
        attributes: ["id", "code", "description"],
      },
    ],
  });

  const out: Record<string, unknown>[] = [];
  for (const r of roles) {
    const nUser = await User.count({ where: { roleId: r.get("id") as number } });
    const plain = r.get({ plain: true }) as Record<string, unknown>;
    out.push({ ...plain, userCount: nUser });
  }
  return out;
}

function assertNonSystem(role: Model) {
  if (role.get("isSystem") as boolean) {
    throw createHttpError(400, "系统内置角色不可删除");
  }
}

export async function createCustomRole(payload: {
  name: unknown;
  slug: unknown;
  isStaff?: unknown;
}) {
  const name = trimmedStringFromUnknown(payload.name);
  const slug = trimmedStringFromUnknown(payload.slug)?.toLowerCase();
  const isStaff = payload.isStaff === undefined ? true : Boolean(payload.isStaff);

  if (!name || !slug) {
    throw createHttpError(400, "角色名称与 slug 不能为空");
  }
  if ([ROLE_SLUG_USER, ROLE_SLUG_SUPER_ADMIN, ROLE_SLUG_MODERATOR].includes(slug)) {
    throw createHttpError(400, "slug 与系统预留冲突");
  }

  const exists = await Role.findOne({ where: { slug } });
  if (exists) {
    throw createHttpError(400, "slug 已存在");
  }

  const row = await Role.create({
    name,
    slug,
    isStaff,
    isSystem: false,
  });
  await (row as unknown as { setPermissions: (p: unknown[]) => Promise<void> }).setPermissions([]);
  return Role.findByPk(row.get("id") as number, {
    include: [
      {
        model: Permission,
        as: "permissions",
        through: { attributes: [] },
        attributes: ["id", "code", "description"],
      },
    ],
  });
}

export async function updateRoleById(
  roleId: number,
  payload: { name?: unknown; isStaff?: unknown; permissionCodes?: unknown },
) {
  const row = await Role.findByPk(roleId);
  if (!row) {
    throw createHttpError(404, "角色不存在");
  }

  const hasMeta = payload.name !== undefined || payload.isStaff !== undefined;
  const hasPerm = payload.permissionCodes !== undefined;
  if (!hasMeta && !hasPerm) {
    throw createHttpError(400, "没有要更新的字段");
  }

  const next: Record<string, unknown> = {};
  if (payload.name !== undefined) {
    const n = trimmedStringFromUnknown(payload.name);
    if (!n) {
      throw createHttpError(400, "名称不能为空");
    }
    next.name = n;
  }
  if (payload.isStaff !== undefined) {
    next.isStaff = Boolean(payload.isStaff);
  }
  if (Object.keys(next).length > 0) {
    await row.update(next);
  }

  if (payload.permissionCodes !== undefined) {
    if (!Array.isArray(payload.permissionCodes)) {
      throw createHttpError(400, "permissionCodes 须为字符串数组");
    }
    const codes = payload.permissionCodes.map((c) => String(c).trim()).filter(Boolean);
    const perms = await Permission.findAll({ where: { code: codes } });
    if (perms.length !== codes.length) {
      throw createHttpError(400, "存在无效的权限码");
    }
    await (row as unknown as { setPermissions: (p: Model[]) => Promise<void> }).setPermissions(
      perms,
    );
    //一个角色的权限变了，所有绑定这个角色的用户缓存都旧了。
    await clearRbacSnapshotCacheForRole(roleId);
  }

  return Role.findByPk(roleId, {
    include: [
      {
        model: Permission,
        as: "permissions",
        through: { attributes: [] },
        attributes: ["id", "code", "description"],
      },
    ],
  });
}

export async function removeRoleById(roleId: number) {
  const row = await Role.findByPk(roleId);
  if (!row) {
    throw createHttpError(404, "角色不存在");
  }
  assertNonSystem(row);
  const slug = String(row.get("slug"));
  if (slug === ROLE_SLUG_SUPER_ADMIN) {
    throw createHttpError(400, "禁止删除超级管理员角色");
  }
  const nUser = await User.count({ where: { roleId } });
  if (nUser > 0) {
    throw createHttpError(400, "仍有用户绑定该角色，无法删除");
  }
  await row.destroy();
}
