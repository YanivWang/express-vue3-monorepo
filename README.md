# express-vue3-monorepo

pnpm workspace：后端 **`apps/backend/rest-api`**，前端 **`apps/frontend/pc-portal`**、**`apps/frontend/pc-admin`**；共享库在 **`packages/*`**（如 `shared`、`request-core`、`js-bridge`、`web-monitor`）。根目录脚本编排 Docker Compose 与各应用命令。

## 仓库结构（概要）

| 路径                      | 说明                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `apps/backend/rest-api`   | Express REST API（Sequelize / MySQL）                                              |
| `apps/frontend/pc-portal` | 门户站点（Vite + Vue 3）                                                           |
| `apps/frontend/pc-admin`  | 管理端（Vite + Vue 3；**默认 Docker 网关栈不包含**，本地单独 `pnpm pc-admin:dev`） |
| `packages/*`              | 前后端复用的 TS / 工具包                                                           |
| `docker/`                 | Compose 覆盖层、`Dockerfile*`、网关 Nginx 配置                                     |
| `e2e/`                    | Playwright 用例（当前覆盖 pc-portal）                                              |
| `docs/openapi.yaml`       | OpenAPI 契约                                                                       |

## 环境要求

- Node.js：`>=20.19.5`（`.nvmrc` 为 **22**，与 Dockerfile 对齐时可用该版本）
- pnpm：`>=10.17.0`
- Docker / Docker Compose：使用 **`pnpm docker:*`** 时需要

## 快速开始

```bash
pnpm install
cp .env.example .env.development
# 按需编辑 .env.development（勿提交进 Git）
```

**推荐**：MySQL、rest-api、pc-portal 与网关均在 Docker 内运行，宿主无需安装数据库——见 **`pnpm docker:dev`**。

可选：仅在宿主调试后端进程时，可在仓库根执行 **`pnpm rest-api:dev`**（须让进程能连上数据库：例如先 **`pnpm docker:dev`** 保持 MySQL 容器运行，在 `docker/docker-compose.dev.yaml` 为 mysql **取消注释 `3306:3306`**，`.env.development` 中 **`DB_HOST=127.0.0.1`**）。

### 常用脚本（根目录）

| 脚本                                            | 作用                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm dev`                                      | 对所有 workspace 子包并行执行 `dev`（若存在）                                |
| `pnpm rest-api:dev` / `pnpm rest-api:dev:debug` | 宿主运行后端（debug 挂 Inspector **9229**）                                  |
| `pnpm pc-portal:dev` / `pnpm pc-admin:dev`      | 宿主运行对应前端                                                             |
| `pnpm db:reset`                                 | 重置后端所用数据库（实现见 `apps/backend/rest-api`）                         |
| `pnpm test`                                     | 后端测试脚本                                                                 |
| `pnpm test:all`                                 | `pnpm test` + `playwright test`                                              |
| `pnpm verify`                                   | `typecheck` + `lint` + `lint:style` + `format:check` + `test:all`            |
| `pnpm docker:dev`                               | 开发 Compose：**MySQL + rest-api + pc-portal + 网关**                        |
| `pnpm docker:dev:down`                          | 停止开发栈（同上 compose 文件组合）                                          |
| `pnpm docker:dev:debug`                         | 开发栈 + 容器内 **`pnpm rest-api:dev:debug`**（9229）                        |
| `pnpm docker:install`                           | 在运行中的 **rest-api** 容器内执行 `pnpm install --frozen-lockfile`          |
| `pnpm docker:pnpm`                              | 在 **rest-api** 容器内执行 `pnpm …`（例：`pnpm run docker:pnpm -- install`） |
| `pnpm docker:test` / `pnpm docker:prod`         | 测试 / 生产编排（需 `.env.test` / `.env.production`）                        |

`prepare` 会安装 Husky Git 钩子（若克隆后未执行过 `pnpm install` 则无钩子）。

## Docker 开发（统一入口网关）

Compose 拉起 **MySQL 8.4（默认仅容器内）+ rest-api + pc-portal + Nginx**：后端通过 **`DB_HOST=mysql`** 在同一 Docker 网络内连库。与本地 **`deer-flow-vue3`**（`docker/nginx/nginx.conf`）同类：**浏览器只访问一个端口**，默认 **`http://127.0.0.1:2026`**（环境变量 **`GATEWAY_HOST_PORT`**），由 `docker/nginx/gateway.dev.docker.conf` 分流——`/api`、`/uploads`、`/openapi.yaml`、`/api-docs`、`/health` 等到 **rest-api**，其余到容器内 **Vite（5173）**。网格内 rest-api 监听 **3000**；Inspector **9229** 映射在 **rest-api** 上。pc-portal 容器内配置 **`VITE_DEV_PROXY_TARGET`**、**`VITE_DEV_HMR_CLIENT_PORT`**（默认与 **`GATEWAY_HOST_PORT`** 一致）以保证经网关访问时的 API 与 HMR。

开发日志（仓库根 **`logs/`**，已在 `.gitignore`）：`logs/rest-api-dev.log`、`logs/pc-portal-dev.log`、`logs/mysql/error.log`（见 `docker/mysql-dev.cnf`）。

若需在宿主用 DataGrip 等连接同一 MySQL，或宿主跑 **`pnpm rest-api:dev`** 连同一实例：按需取消 `docker/docker-compose.dev.yaml` 里 **`mysql`** 的 **`ports`** 注释。

```bash
cp .env.example .env.development   # 若尚未创建
pnpm docker:dev
```

带调试：`pnpm docker:dev:debug`。VS Code / Cursor 可用 `.vscode/launch.json` 中的「Attach to Docker rest-api (9229)」附加调试。

停止开发栈：`pnpm docker:dev:down`。

## Docker 测试 / 生产编排

需要 **`.env.test`** / **`.env.production`**。结构与开发一致：**仅网关暴露宿端口**（默认 **2026**），`gateway.prod.docker.conf` + **pc-portal** 生产镜像（容器内 nginx **只托管 SPA**）。

```bash
pnpm docker:test
pnpm docker:prod
```

## 端到端测试（Playwright）

覆盖 **pc-portal**：首页频道与列表/空态、顶栏进入登录/注册、未登录访问 **`/mine`** 跳转登录并带 `redirect`（见 `e2e/pc-portal.spec.ts`、`playwright.config.ts`）。

- **默认（推荐）**：假定 Compose 已拉起网关（ **`pnpm docker:dev`** 或 **`pnpm docker:test`** 等），Playwright **不**内置启动 Node/Vite；**`baseURL`** 为 **`http://127.0.0.1:${PLAYWRIGHT_GATEWAY_PORT ?? GATEWAY_HOST_PORT ?? 2026}`**（与应用浏览器入口一致）。数据库仅在 MySQL 容器内，由容器内 **rest-api** 连接。
- **宿主本机模式**：`pnpm e2e:local`（等价 **`PLAYWRIGHT_LOCAL_SERVERS=1`**），由 Playwright 拉起 **`pnpm rest-api:dev`** 与 **`pnpm pc-portal:dev`**；此时须让宿主进程能连上 MySQL（例如映射 **`3306:3306`** 且 **`DB_HOST=127.0.0.1`**）。
- 任意覆盖：`PLAYWRIGHT_BASE_URL`；仅改网关端口映射时也可用 **`PLAYWRIGHT_GATEWAY_PORT`**（优先于 **`GATEWAY_HOST_PORT`**）。

**`pnpm verify` / `pnpm test:all`** 包含 E2E，须先满足上述「默认」栈（网关可达）。**`pnpm e2e:docker`** 与 **`pnpm e2e`** 相同，仅为别名。

首跑浏览器：`pnpm e2e:install`（安装 Chromium）。执行：`pnpm e2e`、`pnpm e2e:ui`、`pnpm e2e:local`。报告目录 **`playwright-report/`**（默认忽略于 Git）。

## 文档与契约

- OpenAPI：`docs/openapi.yaml`（运行时 Swagger UI：`/api-docs`）

## 安全说明

- 任何含密码、JWT 密钥的 `.env.*` 均不应提交；模板与说明见 `.env.example`。
- 若历史提交中曾包含真实密钥，请在目标环境**轮换**对应口令与密钥。
