import bcrypt from "bcrypt";

import { Permission, Role, User } from "../db.js";
import {
  PERMISSION_CODES,
  ROLE_SLUG_MODERATOR,
  ROLE_SLUG_SUPER_ADMIN,
  ROLE_SLUG_USER,
} from "../rbac/permission-codes.js";
import { logger } from "../utils/logger.js";

function trimUnset(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const t = value.trim();
  return t === "" ? undefined : t;
}

/**
 * 幂等：写入权限、系统角色、超级管理员全量权限绑定。
 * 若无任何 super_admin 账号且满足启动条件，则创建首个后台账号（见附录「首个超级管理员」）。
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

  const [userRole] = await Role.findOrCreate({
    where: { slug: ROLE_SLUG_USER },
    defaults: {
      name: "注册用户",
      slug: ROLE_SLUG_USER,
      isSystem: true,
      isStaff: false,
    },
  });

  const [moderatorRole] = await Role.findOrCreate({
    where: { slug: ROLE_SLUG_MODERATOR },
    defaults: {
      name: "子管理员（模板）",
      slug: ROLE_SLUG_MODERATOR,
      isSystem: false,
      isStaff: true,
    },
  });
  await (
    moderatorRole as unknown as { setPermissions: (p: unknown[]) => Promise<void> }
  ).setPermissions([]);

  const allPerms = await Permission.findAll();
  await (
    superAdminRole as unknown as { setPermissions: (p: typeof allPerms) => Promise<void> }
  ).setPermissions(allPerms);
  await (userRole as unknown as { setPermissions: (p: unknown[]) => Promise<void> }).setPermissions(
    [],
  );

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
