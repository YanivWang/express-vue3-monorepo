import bcrypt from "bcrypt";
import { Op } from "sequelize";

import { Role, User } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";
import { ROLE_SLUG_SUPER_ADMIN, ROLE_SLUG_USER } from "../rbac/permission-codes.js";
import { escapeMysqlLikePattern } from "../utils/escapeMysqlLike.js";
import { trimmedStringFromUnknown } from "../utils/trimmedStringFromUnknown.js";

import {
  assertUserPermissions,
  ensureNotDemotingLastSuperAdmin,
  getRoleIdBySlugOrThrow,
  loadRbacSnapshot,
  clearRbacSnapshotCache,
} from "./rbac.service.js";

import type { Model } from "sequelize";

const roleBrief = ["id", "slug", "name", "isStaff", "isSystem"] as const;

async function loadRoleOrThrow(roleId: number) {
  const r = await Role.findByPk(roleId);
  if (!r) {
    throw createHttpError(400, "角色不存在");
  }
  return r;
}

function assertStaffRole(role: Model) {
  if (!(role.get("isStaff") as boolean)) {
    throw createHttpError(400, "目标角色须为可登录后台的职员角色");
  }
}

export async function findStaffUsersPage(page: number, limit: number, q?: string | null) {
  const offset = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  const kw = q?.trim();
  if (kw) {
    where.username = { [Op.like]: `%${escapeMysqlLikePattern(kw)}%` };
  }

  const [rows, total] = await Promise.all([
    User.findAll({
      where,
      limit,
      offset,
      order: [["id", "DESC"]],
      include: [
        {
          model: Role,
          as: "role",
          where: { isStaff: true },
          required: true,
          attributes: [...roleBrief],
        },
      ],
      attributes: { exclude: ["password"] },
    }),
    User.count({
      where,
      include: [
        {
          model: Role,
          as: "role",
          where: { isStaff: true },
          required: true,
        },
      ],
    }),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { users: rows, total, totalPages };
}

export async function createStaffUser(
  operatorId: number,
  payload: { username: unknown; password: unknown; roleId: unknown },
) {
  await assertUserPermissions(operatorId, ["admin.staff.invite"], "all");

  const username = trimmedStringFromUnknown(payload.username);
  const password = trimmedStringFromUnknown(payload.password);
  if (!username || !password) {
    throw createHttpError(400, "用户名或密码不能为空");
  }
  const roleId = Number(payload.roleId);
  if (!Number.isFinite(roleId)) {
    throw createHttpError(400, "请选择 roleId");
  }

  const role = await loadRoleOrThrow(roleId);
  assertStaffRole(role);
  const roleSlug = String(role.get("slug"));
  if (roleSlug === ROLE_SLUG_SUPER_ADMIN) {
    const actor = await loadRbacSnapshot(operatorId);
    if (!actor?.isSuperAdmin) {
      throw createHttpError(403, "仅超级管理员可授权超级管理员角色");
    }
  }

  const hashPwd = await bcrypt.hash(password, 10);
  try {
    const created = await User.create({
      username,
      password: hashPwd,
      roleId,
    });
    return User.findByPk(created.get("id") as number, {
      attributes: { exclude: ["password"] },
      include: [{ model: Role, as: "role", attributes: [...roleBrief] }],
    });
  } catch {
    throw createHttpError(400, "用户名可能已存在");
  }
}

export async function updateStaffUser(
  operatorId: number,
  targetId: number,
  payload: { username?: unknown; avatar?: unknown; roleId?: unknown; password?: unknown },
) {
  const row = await User.findByPk(targetId, {
    include: [{ model: Role, as: "role", attributes: [...roleBrief] }],
  });
  if (!row) {
    throw createHttpError(404, "用户不存在");
  }
  const currentRole = row.get("role") as Model | null;
  if (!currentRole || !(currentRole.get("isStaff") as boolean)) {
    throw createHttpError(400, "目标不是后台职员账号");
  }

  const next: Record<string, unknown> = {};
  if (payload.username !== undefined) {
    await assertUserPermissions(operatorId, ["admin.staff.write"], "all");
    const u = trimmedStringFromUnknown(payload.username);
    if (!u) {
      throw createHttpError(400, "用户名不能为空");
    }
    next.username = u;
  }
  if (payload.avatar !== undefined) {
    await assertUserPermissions(operatorId, ["admin.staff.write"], "all");
    next.avatar = trimmedStringFromUnknown(payload.avatar) || null;
  }

  if (payload.password !== undefined) {
    await assertUserPermissions(operatorId, ["admin.staff.reset_password"], "all");
    const p = trimmedStringFromUnknown(payload.password);
    if (!p) {
      throw createHttpError(400, "密码不能为空");
    }
    next.password = await bcrypt.hash(p, 10);
  }

  if (payload.roleId !== undefined) {
    await assertUserPermissions(operatorId, ["admin.staff.assign_role"], "all");
    const newRole = await loadRoleOrThrow(Number(payload.roleId));
    assertStaffRole(newRole);
    const nextSlug = String(newRole.get("slug"));
    if (nextSlug === ROLE_SLUG_SUPER_ADMIN) {
      const actor = await loadRbacSnapshot(operatorId);
      if (!actor?.isSuperAdmin) {
        throw createHttpError(403, "仅超级管理员可授权超级管理员角色");
      }
    }
    await ensureNotDemotingLastSuperAdmin(targetId, nextSlug);
    next.roleId = newRole.get("id");
  }

  if (Object.keys(next).length === 0) {
    throw createHttpError(400, "没有要更新的字段");
  }

  await row.update(next);
  if (payload.roleId !== undefined) {
    await clearRbacSnapshotCache(targetId);
  }
  return User.findByPk(targetId, {
    attributes: { exclude: ["password"] },
    include: [{ model: Role, as: "role", attributes: [...roleBrief] }],
  });
}

/** 撤销后台身份：roleId 降为普通用户；非物理删除，避免文章作者 RESTRICT 冲突 */
export async function revokeStaffUser(operatorId: number, targetId: number) {
  await assertUserPermissions(operatorId, ["admin.staff.delete"], "all");
  if (targetId === operatorId) {
    throw createHttpError(403, "禁止删除当前登录管理员自身");
  }

  const row = await User.findByPk(targetId, {
    include: [{ model: Role, as: "role", attributes: [...roleBrief] }],
  });
  if (!row) {
    throw createHttpError(404, "用户不存在");
  }
  const cur = row.get("role") as Model | null;
  if (!cur || !(cur.get("isStaff") as boolean)) {
    throw createHttpError(400, "目标不是后台职员账号");
  }
  await ensureNotDemotingLastSuperAdmin(targetId, ROLE_SLUG_USER);

  const userRid = await getRoleIdBySlugOrThrow(ROLE_SLUG_USER);
  await row.update({ roleId: userRid });
  await clearRbacSnapshotCache(targetId);
}

/** 供管理员账号页绑定角色下拉用；需路由层 `admin.staff.read` */
export async function listAssignableStaffRoles() {
  const rows = await Role.findAll({
    where: { isStaff: true },
    attributes: ["id", "slug", "name", "isSystem"],
    order: [["id", "ASC"]],
  });
  return rows.map((r) => r.get({ plain: true }) as Record<string, unknown>);
}
