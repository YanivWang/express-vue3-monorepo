# 参与贡献

## 环境

- **Node.js**：`>=20.19.5`（以根目录 `package.json` 的 `engines` 为准；`.nvmrc` 可为 **22**）
- **pnpm**：`>=10.17.0`
- **Redis**：后端启动与脚本链会加载 `apps/backend/rest-api/src/env.ts`，**`REDIS_URL` 必填**（与 `JWT_SECRET`、数据库变量等一致）；Docker 开发栈通常由 Compose 注入，本地直连示例见根目录 [`README.md`](README.md)「快速开始」环境表。
- 安装依赖：在**仓库根目录**执行 `pnpm install`（`preinstall` 仅允许 pnpm）

## 常用脚本

- 后端：`pnpm rest-api:dev`、`pnpm rest-api:dev:debug`、`pnpm rest-api:start`
- 首个超级管理员（根目录已配置 `ADMIN_BOOTSTRAP_USERNAME` / `ADMIN_BOOTSTRAP_PASSWORD`，且 **`REDIS_URL` 等 env 齐备**）：`pnpm --filter @express-vue3-monorepo/rest-api exec tsx scripts/ensure-super-admin.ts`
- 前端：`pnpm pc-portal:dev`（**5173**）、`pnpm pc-admin:dev`（**5174**）
- 全仓库并行开发：`pnpm dev`
- 数据库：`pnpm db:drop-create`、`pnpm db:dedupe-indexes`、`pnpm db:seed-categories`、`pnpm db:seed-post`（推荐顺序见 README「类目种子与合成帖子」）
- 类型检查 / 质量：
  - **`pnpm typecheck`**：各包并行自有脚本（**日常与 CI 权威入口**）
  - **`pnpm typecheck:solution`**：根 `tsc -b`，**仅** `request-core` / `js-bridge` / `web-monitor`
  - **`pnpm typecheck:packages`**：仅 `packages/**` 并行 typecheck
  - `pnpm lint`、`pnpm lint:style`、`pnpm format:check`
  - 提交前全套校验：`pnpm verify`（含 `pnpm test`，即 rest-api Vitest）
- Docker：`pnpm docker:dev`、`pnpm docker:dev:down`、`pnpm docker:dev:debug`（详见 README「Docker 开发」）
- **js-bridge 包内测试**（不在根 `pnpm test` 范围内）：`pnpm --filter @express-vue3-monorepo/js-bridge test`

## 前端环境变量

| App       | 文件                                       | 关键变量                                                                                                                                |
| --------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| pc-portal | `apps/frontend/pc-portal/.env.development` | `VITE_API_BASE_URL`、`VITE_DEV_PROXY_TARGET`、`VITE_DEV_HMR_CLIENT_PORT`；示例见 [`.env.example`](apps/frontend/pc-portal/.env.example) |
| pc-admin  | `apps/frontend/pc-admin/.env.development`  | 同上；网关/生产子路径另设 **`VITE_ADMIN_BASE=/pc-admin/`**（Compose 与生产镜像已注入）                                                  |

两 app 经 `@express-vue3-monorepo/shared` 的 `createAppPcHttp` 发请求；Token 键分别为 **`pc_portal_access_token`**、**`pc_admin_access_token`**。

## 文档

- 首个超级管理员与合成脚本认证：[`docs/admin-bootstrap.md`](docs/admin-bootstrap.md)
- 权限码与路由对照（含 pc-admin 前端）：[`docs/admin-permissions.md`](docs/admin-permissions.md)
- pc-portal 富文本编辑器：[`docs/pc-portal-yaniv-editor.md`](docs/pc-portal-yaniv-editor.md)
- 主说明：[`README.md`](README.md)
- **REST 接口变更须同步** [`docs/openapi.yaml`](docs/openapi.yaml)（paths、schema、`info.description` 与实现一致）

## 提交信息（Conventional Commits）

使用 `feat:`、`fix:`、`chore:`、`docs:`、`refactor:`、`test:`、`build:`、`ci:` 等类型；可带可选 scope，例如：

- `feat(rest-api): …`
- `fix(pc-portal): …`
- `chore(repo): …`

合法 scope 见 [`commitlint.config.cjs`](commitlint.config.cjs)（`rest-api`、`pc-portal`、`pc-admin`、`shared`、`request-core`、`js-bridge`、`web-monitor`、`repo`、`deps`、`docker`、`frontend`、`backend`）。

提交时会经 **commitlint** 校验；pre-commit 会运行 **lint-staged**（ESLint / Stylelint / Prettier）。

## 目录约定

- 后端：`apps/backend/rest-api`（routes → controllers → services；校验 `src/schema/` + `validate()`）
- 前端：`apps/frontend/pc-portal`、`apps/frontend/pc-admin`（Composition API + `<script setup>`；跨 app 逻辑放 `packages/shared`）
- 共享库：`packages/shared`（纯 TS，`tsc --noEmit`）、`packages/request-core`、`packages/js-bridge`、`packages/web-monitor`
- OpenAPI：`docs/openapi.yaml`（相对 monorepo 根）
