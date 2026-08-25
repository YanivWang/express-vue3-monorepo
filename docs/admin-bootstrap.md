# 首个后台超级管理员（bootstrap）

## 环境变量与加载规则

- Monorepo **根目录**的 **`.env.${APP_ENV}`** 与 **`.env.${APP_ENV}.local`** 由 `apps/backend/rest-api/src/env.ts` 在启动时按序合并（**不覆盖**进程已注入的环境变量）；合并后的 `APP_ENV` 与 `NODE_ENV` 须一致，且只能是 `development` | `test` | `production`。
- **`ADMIN_BOOTSTRAP_USERNAME`**、**`ADMIN_BOOTSTRAP_PASSWORD`**：须在经过 trim 后仍非空，才会参与创建或更新超级管理员。**源码中不存在任何硬编码的默认账号/密码**（`rbac-bootstrap.service.ts` 只读环境变量，读不到就仅打告警日志）。
- ⚠️ **但仓库根的 [`.env.development`](../.env.development) 是被跟踪提交的**（`.gitignore` 里以 `!.env.development` 显式放行），其中已填有非空的 `ADMIN_BOOTSTRAP_USERNAME` / `ADMIN_BOOTSTRAP_PASSWORD`。也就是说：**clone 本仓库后直接 `pnpm docker:dev`，会用这组人人可见的口令创建首个 `super_admin`**。它只适合一次性本地试跑；任何共享环境（团队开发机、测试、生产）都必须先改掉这组值，`JWT_SECRET`、`DB_PWD`、`MYSQL_ROOT_PASSWORD`、`REDIS_PASSWORD` 同理。
- **`REDIS_URL`**、**`JWT_SECRET`**、数据库变量等同 `env.ts` **必填项**：凡会 `import` `env.ts` 的进程（含 **`ensure-super-admin.ts`**、HTTP 服务）均须已配置；Docker 开发栈中 `REDIS_URL` 通常由 Compose 注入，宿主直连 Redis 时请设为例如 `redis://:密码@127.0.0.1:6379`（与 `docker-compose.dev.yaml` 映射的 **6379** 一致）。

## `bootstrapRbacIfNeeded()`（API 启动）

实现见 `apps/backend/rest-api/src/services/rbac-bootstrap.service.ts`，在 `connectDatabase()` 末尾调用。

- 幂等写入权限、`super_admin` / `user` 系统角色与模板角色 **`moderator`**（`isStaff: true`、`isSystem: false`，故可在「角色管理」中删除）。
- 权限绑定策略——**只有 `super_admin` 是每次启动强制同步的**：
  - **`super_admin`**：每次启动重新绑定库内全部权限，保证给 `PERMISSION_CODES` 加了新码之后老库自动补齐。
  - **`user` / `moderator`**：**仅在本次启动首次创建该角色时**播种为空；已存在的角色**不再触碰**，所以在「角色管理 → 权限矩阵」里给 `moderator` 勾选的权限**会一直保留，不会被重启清空**。
- 两个内置角色的权限绑定在写入侧被拒绝（`adminRole.service` 的 `assertPermissionsAssignable`，返回 **400**）：
  - **`user`** 是所有注册用户的默认角色，一旦绑上任何 `admin.*`，全站前台用户都会拿到后台入口（`hasStaffEntry`）。
  - **`super_admin`** 由 `rbac.service` 按 slug 直接视为拥有全部权限码，改绑定表不生效，放行只会让管理端显示与实际不符。
  - 需要可配置权限的后台角色，请**新建自定义角色**（`POST /api/admin/roles`）。
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

## pc-admin 登录说明

管理端（`apps/frontend/pc-admin`）启动时同样调用 `GET /api/me` 拉取 **`permissions`**。除有效 JWT 外，账号须具备**至少一项** `admin.*` 权限（`hasStaffEntry`），否则路由守卫跳转 **`/403`**。首个 **`super_admin`** 自动拥有全部 18 项权限码，可直接进入各管理页面。模板角色 **`moderator`** 为职员身份、初始无任何权限绑定，需在「角色管理 → 权限矩阵」中显式勾选后才能使用对应功能；勾选结果会持久保留（重启不会清空）。

## synthetic-it / `pnpm db:seed-post` 中的管理员认证

**`pnpm db:seed-post` 不包含类目种子**；灌帖前须已通过 **`pnpm db:seed-categories`**（或管理端）写入 synthetic-it 所需的 IT 分类树，否则接口会因缺少类目而失败。

合成帖子经 HTTP 调 API，凭证可为（**优先级从高到低**，见 `synthetic-it-resolve-import-token.ts`）：

1. **`REST_API_IMPORT_TOKEN`**：管理员 JWT（Bearer）。
2. **`REST_API_IMPORT_USERNAME`** + **`REST_API_IMPORT_PASSWORD`**：须**成对**非空。
3. 否则使用根目录 **`.env.*`** 中的 **`ADMIN_BOOTSTRAP_USERNAME`** / **`ADMIN_BOOTSTRAP_PASSWORD`** 调用 **`POST /api/login`**（`REST_API_BASE` 已含 `/api` 后缀时等价于 `{REST_API_BASE}/login`）。

`apps/backend/rest-api/scripts/synthetic-it.env` **只**会覆盖种子相关键（`REST_API_*`、`SYNTHETIC_*`、`DEDUPE_INDEXES*`），**不会**从该文件注入 **`ADMIN_BOOTSTRAP_*`**；超级管理员账号口令应只放在 monorepo 根 **`.env.*`**。

## DELETE staff 语义

`/api/admin/staff/:id` 为 **撤销后台身份**：将用户 `roleId` 降回普通 `user` 角色，**不物理删除** `User` 行，从而避免文章作者外键 `RESTRICT` 导致无法「删管理员」。
