/**
 * 幂等：确保指定用户名为超级管理员（super_admin），并写入 bcrypt 密码。
 * 账号来源：仅 `ADMIN_BOOTSTRAP_*`（由 monorepo 根 `.env.${APP_ENV}` 注入），二者均须非空。
 *
 * 依赖与 HTTP 服务相同：须能加载 src/env.js（DB/JWT 等），并执行 connectDatabase（RBAC bootstrap；不包含示例类目）。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import bcrypt from "bcrypt";

import { mergeDotenvFromMonorepoRoot } from "./synthetic-it-merge-monorepo-dotenv.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(apiRoot);

mergeDotenvFromMonorepoRoot();

const username = (process.env.ADMIN_BOOTSTRAP_USERNAME ?? "").trim();
const password = (process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "").trim();
if (!username || !password) {
  console.error(
    "[ensure-super-admin] 请在 monorepo 根 .env.* 设置非空的 ADMIN_BOOTSTRAP_USERNAME 与 ADMIN_BOOTSTRAP_PASSWORD",
  );
  process.exit(1);
}

const { connectDatabase, sequelize, User, Role } = await import("../src/db.js");
const { ROLE_SLUG_SUPER_ADMIN } = await import("../src/rbac/permission-codes.js");

await connectDatabase();

const superRole = await Role.findOne({ where: { slug: ROLE_SLUG_SUPER_ADMIN } });
if (!superRole) {
  console.error(
    "[ensure-super-admin] 未找到 super_admin 角色，请先正常启动过一次 API 或检查 RBAC 种子",
  );
  process.exit(1);
}

const superId = superRole.get("id") as number;
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
  await row.update({ password: hashPwd, roleId: superId });
}

console.log(
  `[ensure-super-admin] ${created ? "已创建" : "已更新"}超级管理员：${username}（slug=super_admin）`,
);
await sequelize.close();
process.exit(0);
