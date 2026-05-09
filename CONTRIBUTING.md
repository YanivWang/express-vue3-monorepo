# 参与贡献

## 环境

- **Node.js**：`>=20.19.5`（以根目录 `package.json` 的 `engines` 为准）
- **pnpm**：`>=10.17.0`
- 安装依赖：在**仓库根目录**执行 `pnpm install`

## 常用脚本

- 后端：`pnpm rest-api:dev`、`pnpm rest-api:start`
- 前端：`pnpm pc-portal:dev`（5173）、`pnpm pc-admin:dev`（5174）
- 全仓库并行开发：`pnpm dev`
- 类型检查 / 质量：`pnpm typecheck`、`pnpm lint`、`pnpm lint:style`、`pnpm format:check`

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
