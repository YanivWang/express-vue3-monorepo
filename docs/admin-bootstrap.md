# 首个后台超级管理员（bootstrap）

## 环境变量与加载规则

- Monorepo **根目录**的 **`.env.${APP_ENV}`** 与 **`.env.${APP_ENV}.local`** 由 `apps/backend/rest-api/src/env.ts` 在启动时按序合并（**不覆盖**进程已注入的环境变量）；合并后的 `APP_ENV` 与 `NODE_ENV` 须一致，且只能是 `development` | `test` | `production`。
- **`ADMIN_BOOTSTRAP_USERNAME`**、**`ADMIN_BOOTSTRAP_PASSWORD`**：须在经过 trim 后仍非空，才会参与创建或更新超级管理员。**代码与仓库内无任何默认账号/密码**。
- **`REDIS_URL`**、**`JWT_SECRET`**、数据库变量等同 `env.ts` **必填项**：凡会 `import` `env.ts` 的进程（含 **`ensure-super-admin.ts`**、HTTP 服务）均须已配置；Docker 开发栈中 `REDIS_URL` 通常由 Compose 注入，宿主直连 Redis 时请设为例如 `redis://:密码@127.0.0.1:6379`（与 `docker-compose.dev.yaml` 映射的 **6379** 一致）。

## `bootstrapRbacIfNeeded()`（API 启动）

实现见 `apps/backend/rest-api/src/services/rbac-bootstrap.service.ts`，在 `connectDatabase()` 末尾调用。

- 幂等写入权限、`super_admin` / `user` 系统角色、模板角色 **`moderator`**（`isStaff: true`，初始 **无** 权限绑定）、以及 `super_admin` 与库内全部权限的全量绑定。
- 若库里**已存在**至少一名 `super_admin`：**不会**再自动创建账号。
- 若**不存在**任何 `super_admin`：
  - 且两项 **`ADMIN_BOOTSTRAP_*`** 均已配置：以该用户名创建用户（bcrypt 存密），或若用户已存在则更新其 `roleId` / `password`。
  - 若缺一或为空：仅记录告警日志 `rbac_bootstrap_no_super_admin`，**不创建**用户。

## 手工执行 `ensure-super-admin.ts`

脚本：`apps/backend/rest-api/scripts/ensure-super-admin.ts`。

```bash
# 在仓库根（须已配置根目录 ADMIN_BOOTSTRAP_*）
pnpm --filter @express-vue3-monorepo/rest-api exec tsx scripts/ensure-super-admin.ts

# 或在 apps/backend/rest-api 下
pnpm exec tsx scripts/ensure-super-admin.ts
```

脚本会 `mergeDotenvFromMonorepoRoot()`、`connectDatabase()`（含上述 RBAC bootstrap），再**幂等**将 `ADMIN_BOOTSTRAP_USERNAME` 对应用户设为 `super_admin` 并写入环境中的明文密码（bcrypt）。`import` 链会加载 `src/env.ts`，故 **`REDIS_URL`** 等必填项与跑 HTTP 服务时一致（脚本本身不连 Redis，但进程启动阶段会校验环境）。适用：空库后想先不启动 HTTP、或需要**不重启进程**地重置管理员密码。

## 推荐操作路径

1. **方式 A（推荐，开发）**：根目录配置好 **`ADMIN_BOOTSTRAP_*`** 后，在 `apps/backend/rest-api` 执行 **`pnpm db:drop-create`**（或根目录 `pnpm --filter @express-vue3-monorepo/rest-api db:drop-create`），再启动 **`pnpm --filter @express-vue3-monorepo/rest-api dev`**。空库且无 `super_admin` 时，首次启动会按环境变量创建首个超级管理员。
2. **方式 B（生产）**：同样配置非空的 **`ADMIN_BOOTSTRAP_USERNAME`** / **`ADMIN_BOOTSTRAP_PASSWORD`** 后部署并启动，由 `bootstrapRbacIfNeeded()` 在首次无超级管理员时创建。
3. **方式 C（不推荐）**：在熟悉迁移与种子语义的前提下，直接在 `Roles` / `Users` 表为某用户写入 `super_admin` 的 `roleId`。

表结构由 `sequelize.sync` 与模型对齐（见 `apps/backend/rest-api/src/db.ts`）；开发阶段模型变更后推荐 **`pnpm db:drop-create`** 再启动。仅删库脚本见 `apps/backend/rest-api/scripts/reset-db.ts`。

## synthetic-it / `pnpm db:seed-post` 中的管理员认证

**`pnpm db:seed-post` 不包含类目种子**；灌帖前须已通过 **`pnpm db:seed-categories`**（或管理端）写入 synthetic-it 所需的 IT 分类树，否则接口会因缺少类目而失败。

合成帖子经 HTTP 调 API，凭证可为（**优先级从高到低**，见 `synthetic-it-resolve-import-token.ts`）：

1. **`REST_API_IMPORT_TOKEN`**：管理员 JWT（Bearer）。
2. **`REST_API_IMPORT_USERNAME`** + **`REST_API_IMPORT_PASSWORD`**：须**成对**非空。
3. 否则使用根目录 **`.env.*`** 中的 **`ADMIN_BOOTSTRAP_USERNAME`** / **`ADMIN_BOOTSTRAP_PASSWORD`** 调用 **`POST /login`**。

`apps/backend/rest-api/scripts/synthetic-it.env` **只**会覆盖种子相关键（`REST_API_*`、`SYNTHETIC_*`、`DEDUPE_INDEXES*`），**不会**从该文件注入 **`ADMIN_BOOTSTRAP_*`**；超级管理员账号口令应只放在 monorepo 根 **`.env.*`**。

## DELETE staff 语义

`/api/admin/staff/:id` 为 **撤销后台身份**：将用户 `roleId` 降回普通 `user` 角色，**不物理删除** `User` 行，从而避免文章作者外键 `RESTRICT` 导致无法「删管理员」。
