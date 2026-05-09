# express-vue3-monorepo

pnpm workspace：后端 `apps/backend/rest-api`，前端 `apps/frontend/pc-portal`、`apps/frontend/pc-admin`。根目录编排脚本调用 Docker Compose。

## 环境要求

- Node.js：`>=20.19.5`（与 Dockerfile 对齐时可用 **22**，见 `.nvmrc`）
- pnpm：`>=10.17.0`

## 快速开始（本机）

```bash
pnpm install
cp .env.example .env.development
# 按需编辑 .env.development（勿提交进 Git）
pnpm rest-api:dev
```

其他常用脚本见根目录 `package.json` 的 `scripts`（如 `pc-portal:dev`、`pc-admin:dev`、`verify`）。

## Docker 开发

使用仓库根目录下的 `.env.development`（由本机维护，已从版本库忽略）：

```bash
pnpm docker:dev
```

带调试端口 `9229`：

```bash
pnpm docker:dev:debug
```

VS Code / Cursor 可用 `.vscode/launch.json` 中的「Attach to Docker App (9229)」附加调试。

## 文档与契约

- OpenAPI：`docs/openapi.yaml`（运行时 Swagger UI：`/api-docs`）

## 安全说明

- 任何含密码、JWT 密钥的 `.env.*` 均不应提交；模板与说明见 `.env.example`。
- 若历史提交中曾包含真实密钥，请在目标环境**轮换**对应口令与密钥。
