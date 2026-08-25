import bcrypt from "bcrypt";

import { Permission, Role, User } from "../db.js";
import {
  PERMISSION_CODES,
  ROLE_SLUG_MODERATOR,
  ROLE_SLUG_SUPER_ADMIN,
  ROLE_SLUG_USER,
} from "../rbac/permission-codes.js";
import { logger } from "../utils/logger.js";

import type { Model } from "sequelize";

function trimUnset(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const t = value.trim();
  return t === "" ? undefined : t;
}

/** Sequelize 的 belongsToMany 关联方法未进入 Model 类型，收敛在一处做窄化，避免各调用点重复断言。 */
async function setRolePermissions(role: Model, permissions: Model[]): Promise<void> {
  await (role as unknown as { setPermissions: (p: Model[]) => Promise<void> }).setPermissions(
    permissions,
  );
}

/**
 * 幂等：写入权限、系统角色、超级管理员全量权限绑定。
 * 若无任何 super_admin 账号且满足启动条件，则创建首个后台账号（见 docs/admin-bootstrap.md）。
 *
 * 权限绑定策略（**只有 super_admin 是每次启动强制同步的**）：
 * - `super_admin`：每次启动都重新绑定库内全部权限，保证新增 PERMISSION_CODES 后老库自动补齐。
 * - `user` / `moderator`：**仅在本次启动首次创建该角色时**播种为空。已存在的角色不再触碰，
 *   否则管理员在「角色管理 → 权限矩阵」里的勾选会在下次重启被静默清空。
 *   `user` 不得持有任何后台权限这一约束，改由 `adminRole.service` 在写入时拒绝（见 assertPermissionsAssignable）。
 */
export async function bootstrapRbacIfNeeded(): Promise<void> {
  for (const code of PERMISSION_CODES) {
    await Permission.findOrCreate({
      where: { code },
      defaults: { code, description: code },
    });
  }

  const [superAdminRole] = await Role.findOrCreate({
    where: { slug: ROLE_SLUG_SUPER_ADMIN },
    defaults: {
      name: "超级管理员",
      slug: ROLE_SLUG_SUPER_ADMIN,
      isSystem: true,
      isStaff: true,
    },
  });

  const [userRole, userRoleCreated] = await Role.findOrCreate({
    where: { slug: ROLE_SLUG_USER },
    defaults: {
      name: "注册用户",
      slug: ROLE_SLUG_USER,
      isSystem: true,
      isStaff: false,
    },
  });

  const [moderatorRole, moderatorRoleCreated] = await Role.findOrCreate({
    where: { slug: ROLE_SLUG_MODERATOR },
    defaults: {
      name: "子管理员（模板）",
      slug: ROLE_SLUG_MODERATOR,
      isSystem: false,
      isStaff: true,
    },
  });

  const allPerms = await Permission.findAll();
  // super_admin 是唯一每次启动强制全量同步的角色（新增权限码后老库自动补齐）。
  await setRolePermissions(superAdminRole, allPerms);
  // 其余两个角色只在首次创建时播种空权限，之后交给管理端维护，避免重启清空既有勾选。
  if (userRoleCreated) {
    await setRolePermissions(userRole, []);
  }
  if (moderatorRoleCreated) {
    await setRolePermissions(moderatorRole, []);
  }

  const superId = superAdminRole.get("id") as number;

  const superAdminCount = await User.count({
    include: [
      {
        model: Role,
        as: "role",
        where: { slug: ROLE_SLUG_SUPER_ADMIN },
        required: true,
        attributes: [],
      },
    ],
  });

  if (superAdminCount > 0) {
    return;
  }

  const username = trimUnset(process.env.ADMIN_BOOTSTRAP_USERNAME);
  const password = trimUnset(process.env.ADMIN_BOOTSTRAP_PASSWORD);

  if (!username || !password) {
    logger.warn(
      "rbac_bootstrap_no_super_admin",
      "库中无任何 super_admin。请在 monorepo 根 .env.* 设置非空的 ADMIN_BOOTSTRAP_USERNAME 与 ADMIN_BOOTSTRAP_PASSWORD 后重启以创建首个后台账号，或通过数据库将某用户 roleId 指向 super_admin。",
    );
    return;
  }

  const hashPwd = await bcrypt.hash(password, 10);
  const [row, created] = await User.findOrCreate({
    where: { username },
    defaults: {
      username,
      password: hashPwd,
      roleId: superId,
    },
  });

  if (!created) {
    await row.update({ roleId: superId, password: hashPwd });
  }

  logger.info("rbac_bootstrap_super_admin_created", { username });
}
