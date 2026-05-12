# 参与贡献

## 环境

- **Node.js**：`>=20.19.5`（以根目录 `package.json` 的 `engines` 为准）
- **pnpm**：`>=10.17.0`
- 安装依赖：在**仓库根目录**执行 `pnpm install`

## 常用脚本

- 后端：`pnpm rest-api:dev`、`pnpm rest-api:start`
- 首个超级管理员（根目录已配置 `ADMIN_BOOTSTRAP_USERNAME` / `ADMIN_BOOTSTRAP_PASSWORD`）：`pnpm --filter @express-vue3-monorepo/rest-api exec tsx scripts/ensure-super-admin.ts`
- 前端：`pnpm pc-portal:dev`（5173）、`pnpm pc-admin:dev`（5174）
- 全仓库并行开发：`pnpm dev`
- 类型检查 / 质量：`pnpm typecheck`、`pnpm lint`、`pnpm lint:style`、`pnpm format:check`；提交前全套校验：`pnpm verify`（含 `pnpm test:all`：单测 + Playwright E2E）

## 文档

- 首个超级管理员与合成脚本认证：[`docs/admin-bootstrap.md`](docs/admin-bootstrap.md)
- 权限码与路由对照：[`docs/admin-permissions.md`](docs/admin-permissions.md)
- 主说明：[`README.md`](README.md)

## 提交信息（Conventional Commits）

使用 `feat:`、`fix:`、`chore:`、`docs:`、`refactor:`、`test:`、`build:`、`ci:` 等类型；可带可选 scope，例如：

- `feat(rest-api): …`
- `fix(pc-portal): …`
- `chore(repo): …`

提交时会经 **commitlint** 校验；pre-commit 会运行 **lint-staged**（ESLint / Stylelint / Prettier）。

## 目录约定

- 后端：`apps/backend/rest-api`
- 前端：`apps/frontend/pc-portal`、`apps/frontend/pc-admin`
- OpenAPI：`docs/openapi.yaml`（相对 monorepo 根）
