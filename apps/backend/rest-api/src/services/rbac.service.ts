import { Permission, Role, User } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";
import { PERMISSION_CODES, ROLE_SLUG_SUPER_ADMIN } from "../rbac/permission-codes.js";
import { redis } from "../redis.js";

import type { PermissionMode } from "../rbac/permission-codes.js";
import type { Model } from "sequelize";

const permissionInclude = {
  model: Permission,
  as: "permissions" as const,
  attributes: ["code"],
  through: { attributes: [] },
};

const RBAC_SNAPSHOT_CACHE_TTL_SECONDS = 60 * 5;

function rbacSnapshotCacheKey(userId: number) {
  return `rbac:snapshot:user:${userId}`;
}
type CachedRbacSnapshot = {
  userId: number;
  roleId: number;
  roleSlug: string;
  isSuperAdmin: boolean;
  permissionCodes: string[];
};
function snapshotToCache(snapshot: RbacSnapshot): CachedRbacSnapshot {
  return {
    userId: snapshot.userId,
    roleId: snapshot.roleId,
    roleSlug: snapshot.roleSlug,
    isSuperAdmin: snapshot.isSuperAdmin,
    permissionCodes: [...snapshot.permissionCodes],
  };
}
function snapshotFromCache(cached: CachedRbacSnapshot): RbacSnapshot {
  return {
    ...cached,
    permissionCodes: new Set(cached.permissionCodes),
  };
}

export type RbacSnapshot = {
  userId: number;
  roleId: number;
  roleSlug: string;
  isSuperAdmin: boolean;
  /** 非超级管理员：显式绑定权限码集合；超级管理员等价于全集 */
  permissionCodes: ReadonlySet<string>;
};

async function snapshotFromLoadedUser(model: Model | null): Promise<RbacSnapshot | null> {
  if (!model) return null;

  const userId = Number(model.get("id"));
  const role = model.get("role") as Model | null | undefined;
  const roleSlug = role ? String(role.get("slug")) : "";
  const roleId = role ? Number(role.get("id")) : Number(model.get("roleId"));

  if (!roleSlug || !Number.isFinite(roleId)) {
    return null;
  }

  const isSuperAdmin = roleSlug === ROLE_SLUG_SUPER_ADMIN;
  if (isSuperAdmin) {
    return {
      userId,
      roleId,
      roleSlug,
      isSuperAdmin: true,
      permissionCodes: new Set(PERMISSION_CODES),
    };
  }

  const perms = (role?.get("permissions") as Model[] | undefined) ?? [];
  const codes = new Set(perms.map((p) => String(p.get("code"))));
  return { userId, roleId, roleSlug, isSuperAdmin: false, permissionCodes: codes };
}

export async function loadRbacSnapshot(userId: number): Promise<RbacSnapshot | null> {
  const key = rbacSnapshotCacheKey(userId);

  try {
    const cached = await redis.get(key);
    if (cached) {
      return snapshotFromCache(JSON.parse(cached) as CachedRbacSnapshot);
    }
  } catch {
    // Redis 缓存异常时不影响权限判断，继续走 MySQL。
  }

  const user = await User.findByPk(userId, {
    include: [{ model: Role, as: "role", include: [permissionInclude] }],
  });
  const snapshot = await snapshotFromLoadedUser(user);

  if (snapshot) {
    try {
      await redis.setEx(
        key,
        RBAC_SNAPSHOT_CACHE_TTL_SECONDS,
        JSON.stringify(snapshotToCache(snapshot)),
      );
    } catch {
      // 写缓存失败时也不影响主流程。
    }
  }

  return snapshot;
}

export async function clearRbacSnapshotCache(userId: number): Promise<void> {
  try {
    await redis.del(rbacSnapshotCacheKey(userId));
  } catch {
    // 删除缓存失败不阻断写操作。
  }
}

export async function clearRbacSnapshotCacheForRole(roleId: number): Promise<void> {
  const users = await User.findAll({
    where: { roleId },
    attributes: ["id"],
  });

  const keys = users.map((u) => rbacSnapshotCacheKey(u.get("id") as number));
  if (keys.length === 0) return;

  try {
    await redis.del(keys);
  } catch {
    // 删除缓存失败不阻断写操作。
  }
}

export function snapshotHasPermission(snapshot: RbacSnapshot, code: string): boolean {
  if (snapshot.isSuperAdmin) return true;
  return snapshot.permissionCodes.has(code);
}

export function snapshotHasPermissions(
  snapshot: RbacSnapshot,
  codes: readonly string[],
  mode: PermissionMode,
): boolean {
  if (snapshot.isSuperAdmin) return true;
  if (codes.length === 0) return true;
  if (mode === "any") {
    return codes.some((c) => snapshot.permissionCodes.has(c));
  }
  return codes.every((c) => snapshot.permissionCodes.has(c));
}

export async function userHasPermissions(
  userId: number,
  codes: readonly string[],
  mode: PermissionMode,
): Promise<boolean> {
  const snap = await loadRbacSnapshot(userId);
  if (!snap) return false;
  return snapshotHasPermissions(snap, codes, mode);
}

export async function assertUserPermissions(
  userId: number,
  codes: readonly string[],
  mode: PermissionMode,
): Promise<void> {
  const ok = await userHasPermissions(userId, codes, mode);
  if (!ok) {
    throw createHttpError(403, "无权执行此操作");
  }
}

export async function assertUserPermission(userId: number, code: string): Promise<void> {
  await assertUserPermissions(userId, [code], "all");
}

export async function getRoleIdBySlugOrThrow(slug: string): Promise<number> {
  const r = await Role.findOne({ where: { slug } });
  if (!r) {
    throw createHttpError(500, "系统角色未初始化");
  }
  return r.get("id") as number;
}

export async function countUsersWithRoleSlug(slug: string): Promise<number> {
  return User.count({
    include: [
      {
        model: Role,
        as: "role",
        where: { slug },
        required: true,
      },
    ],
  });
}

/** 将用户从 super_admin 调离前调用，须保留至少一名超级管理员 */
export async function ensureNotDemotingLastSuperAdmin(
  targetUserId: number,
  nextRoleSlug: string,
): Promise<void> {
  const snap = await loadRbacSnapshot(targetUserId);
  if (!snap) {
    throw createHttpError(404, "用户不存在或未绑定角色");
  }
  if (snap.roleSlug !== ROLE_SLUG_SUPER_ADMIN) {
    return;
  }
  if (nextRoleSlug === ROLE_SLUG_SUPER_ADMIN) {
    return;
  }
  const n = await countUsersWithRoleSlug(ROLE_SLUG_SUPER_ADMIN);
  if (n <= 1) {
    throw createHttpError(400, "须至少保留一名超级管理员");
  }
}
