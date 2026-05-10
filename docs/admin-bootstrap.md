# 首个后台超级管理员（bootstrap）

在本仓库根 `.env.development`（或当前 `APP_ENV` 对应 `.env.*`）**必须**同时配置非空的 `ADMIN_BOOTSTRAP_USERNAME` 与 `ADMIN_BOOTSTRAP_PASSWORD`。`bootstrapRbacIfNeeded()`、`pnpm ensure-super-admin`、synthetic-it 登录均只认环境变量，**无代码内默认账号/密码**。

1. **方式 A（推荐，开发）**：在 `apps/backend/rest-api` 下执行 `pnpm db:reset`（或根目录 `pnpm --filter @vue3-express-monorepo/rest-api db:reset`；或首次空库），确认根目录 `.env.development` 已配置上述两键后，启动 `pnpm --filter @vue3-express-monorepo/rest-api dev`。在库中尚无 `super_admin` 时，`bootstrapRbacIfNeeded()` 会用该用户名与明文密码（写入前 bcrypt）创建首个超级管理员。
2. **方式 B（生产）**：同样必须配置非空的 `ADMIN_BOOTSTRAP_USERNAME` / `ADMIN_BOOTSTRAP_PASSWORD` 后重启以创建首个超级管理员。
3. **方式 C（手工 SQL）**：在 `Roles / Users` 表中为某用户写入 `super_admin` 的 `roleId`（不推荐，除非你熟悉迁移与种子语义）。

详见 `apps/backend/rest-api/scripts/reset-db.ts`（仅删库）；表结构与 RBAC 种子在应用启动时的 `sequelize.sync` + `bootstrapRbacIfNeeded`。

## DELETE staff 语义

`/api/admin/staff/:id` 为 **撤销后台身份**：将用户 `roleId` 降回普通 `user` 角色，**不物理删除** `User` 行，从而避免文章作者外键 `RESTRICT` 导致无法「删管理员」。
