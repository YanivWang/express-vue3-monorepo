# 首个后台超级管理员（bootstrap）

1. **方式 A（推荐，开发）**：在 `apps/backend/rest-api` 下执行 `pnpm db:reset`（或根目录 `pnpm --filter @vue3-express-monorepo/rest-api db:reset`；或首次空库），然后启动 `pnpm --filter @vue3-express-monorepo/rest-api dev`。在 **development** 且库中尚无 `super_admin` 账号时，`bootstrapRbacIfNeeded()` 会使用默认用户名 `admin`（或环境变量 `ADMIN_BOOTSTRAP_USERNAME`）和密码 **`admin_dev_change_me`** 创建首个超级管理员（或通过 `ADMIN_BOOTSTRAP_USERNAME`/`ADMIN_BOOTSTRAP_PASSWORD` 覆盖）。
2. **方式 B（生产）**：必须通过环境变量显式配置 `ADMIN_BOOTSTRAP_PASSWORD`（及可选 `ADMIN_BOOTSTRAP_USERNAME`）后重启一次以创建首个超级管理员；**禁止**在未设置密码的生产环境依赖隐式默认值。
3. **方式 C（手工 SQL）**：在 `Roles / Users` 表中为某用户写入 `super_admin` 的 `roleId`（不推荐，除非你熟悉迁移与种子语义）。

详见 `apps/backend/rest-api/scripts/reset-db.ts`（仅删库）；表结构与 RBAC 种子在应用启动时的 `sequelize.sync` + `bootstrapRbacIfNeeded`。

## DELETE staff 语义

`/api/admin/staff/:id` 为 **撤销后台身份**：将用户 `roleId` 降回普通 `user` 角色，**不物理删除** `User` 行，从而避免文章作者外键 `RESTRICT` 导致无法「删管理员」。
