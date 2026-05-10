/**
 * 幂等：确保指定用户名为超级管理员（super_admin），并写入 bcrypt 密码。
 * 默认用户名 root、密码 123456（仅适合本地开发）；可用环境变量覆盖：
 *   ENSURE_SUPER_ADMIN_USERNAME、ENSURE_SUPER_ADMIN_PASSWORD
 *
 * 依赖与 HTTP 服务相同：须能加载 src/env.js（DB/JWT 等），并执行 connectDatabase（RBAC bootstrap；不包含示例类目）。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import bcrypt from "bcrypt";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(apiRoot);

const username = (process.env.ENSURE_SUPER_ADMIN_USERNAME ?? "root").trim();
const password = process.env.ENSURE_SUPER_ADMIN_PASSWORD ?? "123456";

if (!username) {
  console.error("[ensure-super-admin] ENSURE_SUPER_ADMIN_USERNAME 不能为空");
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
    legacyRole: 1,
  },
});

if (!created) {
  await row.update({ password: hashPwd, roleId: superId, legacyRole: 1 });
}

console.log(
  `[ensure-super-admin] ${created ? "已创建" : "已更新"}超级管理员：${username}（slug=super_admin）`,
);
await sequelize.close();
process.exit(0);
