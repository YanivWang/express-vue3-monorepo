# vue3-express-monorepo

基于 **pnpm workspace** 的全栈单体仓库：**Express REST API**（`apps/backend/rest-api`）+ **Vue 3 / Vite** 前台与管理端（`apps/frontend/pc-portal`、`pc-admin`），共享逻辑置于 **`packages/*`**。根目录提供脚本编排、Docker Compose、统一代码风格与提交约定。

---

## 目录

- [技术栈](#技术栈)
- [仓库结构](#仓库结构)
- [Workspace 包命名](#workspace-包命名)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [常用脚本](#常用脚本)
- [类型检查：`typecheck` 与 `typecheck:solution`](#类型检查typecheck-与-typechecksolution)
- [代码质量与提交约定](#代码质量与提交约定)
- [API 契约与 Swagger](#api-契约与-swagger)
- [Docker 开发 / 测试 / 生产](#docker-开发--测试--生产)
- [端到端测试（Playwright）](#端到端测试playwright)
- [CODEOWNERS](#codeowners)
- [npm 镜像与安全](#npm-镜像与安全)
- [文档与契约文件](#文档与契约文件)

---

## 技术栈

| 层级   | 技术                                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------- |
| 后端   | Node.js、Express（ESM）、TypeScript、Sequelize、MySQL、JWT、Zod                                                       |
| 前端   | Vue 3、Vite、TypeScript、Pinia、Vue Router（pc-portal 另含 Element Plus 等与 shared 对齐的栈）                        |
| 共享包 | TypeScript 库：`shared`、`request-core`、`js-bridge`、`web-monitor`                                                   |
| 工程化 | pnpm workspace、`pnpm` catalog、ESLint 9 flat、typescript-eslint、Prettier、Stylelint、Husky、lint-staged、Commitlint |
| 契约   | OpenAPI 3.0（[`docs/openapi.yaml`](docs/openapi.yaml)），运行时 Swagger UI                                            |

---

## 仓库结构

| 路径                                                 | 说明                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`apps/backend/rest-api`](apps/backend/rest-api)     | Express REST API（Sequelize / MySQL）                                              |
| [`apps/frontend/pc-portal`](apps/frontend/pc-portal) | 门户站点（Vite + Vue 3）                                                           |
| [`apps/frontend/pc-admin`](apps/frontend/pc-admin)   | 管理端（Vite + Vue 3；**默认 Docker 网关栈不包含**，本地单独 `pnpm pc-admin:dev`） |
| [`packages/shared`](packages/shared)                 | PC/H5 共享组件、hooks、请求 preset、类型与样式等                                   |
| [`packages/request-core`](packages/request-core)     | HTTP 客户端核心（与后端响应约定对齐）                                              |
| [`packages/js-bridge`](packages/js-bridge)           | H5 宿主 / JSBridge 抽象                                                            |
| [`packages/web-monitor`](packages/web-monitor)       | 前端监控封装入口                                                                   |
| [`docker/`](docker/)                                 | Compose 覆盖层、`Dockerfile*`、网关 Nginx                                          |
| [`e2e/`](e2e/)                                       | Playwright 用例（当前主要覆盖 pc-portal）                                          |
| [`docs/openapi.yaml`](docs/openapi.yaml)             | OpenAPI 契约（提交仓库，与实现同步维护）                                           |
| [`.github/CODEOWNERS`](.github/CODEOWNERS)           | 代码所有者（需替换占位 `@REPLACE_WITH_GITHUB_OWNER`）                              |

---

## Workspace 包命名

在仓库根目录使用 `pnpm --filter <name>` 时，可采用 **`package.json` 中的 `name`**：

| 目录                      | `package.json` name                   |
| ------------------------- | ------------------------------------- |
| `apps/backend/rest-api`   | `@vue3-express-monorepo/rest-api`     |
| `apps/frontend/pc-portal` | `@vue3-express-monorepo/pc-portal`    |
| `apps/frontend/pc-admin`  | `@vue3-express-monorepo/pc-admin`     |
| `packages/shared`         | `@vue3-express-monorepo/shared`       |
| `packages/request-core`   | `@vue3-express-monorepo/request-core` |
| `packages/js-bridge`      | `@vue3-express-monorepo/js-bridge`    |
| `packages/web-monitor`    | `@vue3-express-monorepo/web-monitor`  |

示例：

```bash
pnpm --filter @vue3-express-monorepo/rest-api run build
pnpm --filter @vue3-express-monorepo/pc-portal run dev
```

---

## 环境要求

- **Node.js**：`>=20.19.5`（仓库根 `.nvmrc` 可为 **22**，与 Dockerfile 对齐时推荐使用）
- **pnpm**：`>=10.17.0`（与 [`package.json`](package.json) 中 `packageManager` 字段一致）
- **Docker / Docker Compose**：使用 `pnpm docker:*` 拉起栈时需要

---

## 快速开始

```bash
pnpm install
cp .env.example .env.development
# 按需编辑 .env.development（勿提交真实密钥）
```

**推荐**：数据库、rest-api、pc-portal 与网关均在 Docker 内运行——见 **`pnpm docker:dev`**。

若仅在**宿主**调试后端进程，可在仓库根执行 **`pnpm rest-api:dev`**（需能连上 MySQL：例如先 **`pnpm docker:dev`** 保持 MySQL 容器运行，在 `docker/docker-compose.dev.yaml` 为 mysql **取消注释 `3306:3306`**，并在 `.env.development` 中设置 **`DB_HOST=127.0.0.1`**）。

---

## 常用脚本

| 脚本                                                                 | 作用                                                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`                                                           | 对所有 workspace 子包并行执行 `dev`（若存在）                                                                            |
| `pnpm rest-api:dev` / `pnpm rest-api:dev:debug`                      | 宿主运行后端（debug 暴露 Inspector **9229**）                                                                            |
| `pnpm pc-portal:dev` / `pnpm pc-admin:dev`                           | 宿主运行对应前端                                                                                                         |
| `pnpm db:reset`                                                      | 重置后端所用数据库（实现见 `apps/backend/rest-api`）                                                                     |
| `pnpm test`                                                          | 后端测试脚本                                                                                                             |
| `pnpm test:all`                                                      | `pnpm test` + `playwright test`                                                                                          |
| `pnpm typecheck`                                                     | 各包并行执行各自的 `typecheck`（**全仓类型正确性的权威入口**）                                                           |
| `pnpm typecheck:solution`                                            | 根目录 `tsc -b`，仅构建 [`tsconfig.json`](tsconfig.json) 中引用的**纯 TS workspace 包**的 declaration 构图（见下文说明） |
| `pnpm typecheck:packages`                                            | 仅对 `./packages/**` 并行 typecheck                                                                                      |
| `pnpm lint` / `pnpm lint:fix`                                        | ESLint（根 [`eslint.config.mjs`](eslint.config.mjs)，按路径区分后端 / 前端 / 包）                                        |
| `pnpm lint:style` / `pnpm lint:style:fix`                            | Stylelint（`apps/frontend`、`packages` 下 css/scss/vue）                                                                 |
| `pnpm format` / `pnpm format:check`                                  | Prettier                                                                                                                 |
| `pnpm verify`                                                        | `typecheck` + `lint` + `lint:style` + `format:check` + `test:all`                                                        |
| `pnpm e2e` / `pnpm e2e:ui` / `pnpm e2e:local`                        | Playwright（详见下文）                                                                                                   |
| `pnpm docker:dev` / `pnpm docker:dev:down` / `pnpm docker:dev:debug` | Docker 开发栈                                                                                                            |
| `pnpm docker:install` / `pnpm docker:pnpm`                           | 在运行中的 **rest-api** 容器内执行安装或其它 `pnpm` 命令                                                                 |
| `pnpm docker:test` / `pnpm docker:prod`                              | 测试 / 生产编排（需 `.env.test` / `.env.production`）                                                                    |

`prepare` 会安装 **Husky** Git 钩子；若克隆后未执行过 `pnpm install` 则无钩子。

---

## 类型检查：`typecheck` 与 `typecheck:solution`

- **`pnpm typecheck`**：每个应用/包使用自己的 `tsconfig`（后端 `tsc --noEmit`，含 Vue 的包使用 `vue-tsc`）。**日常开发与 CI 应以该命令为准**。
- **`pnpm typecheck:solution`**：在根目录执行 **`tsc -b`**，当前 [`tsconfig.json`](tsconfig.json) 仅引用若干 **`packages/*/tsconfig.build.json`**（纯 TS、可生成声明产物的构图）。**不包含** Vue 应用、`packages/shared`（依赖 SFC 与 `vue-tsc`）、以及 **`apps/backend/rest-api`**（避免 declaration 与 Express 类型导出引发的便携性问题）。用于补充「workspace 纯 TS 库的 project references 构建」，**不能替代**全仓 `pnpm typecheck`。

---

## 代码质量与提交约定

- **ESLint**：单一 flat 配置，按路径分型（Node 后端 / Vue+TS 前端与 `packages`）；集成 `typescript-eslint`（含类型感知规则与合理覆盖）、`eslint-plugin-vue`、`eslint-plugin-import` + TypeScript resolver、`eslint-config-prettier`。
- **Prettier**：根目录 [`prettier.config.mjs`](prettier.config.mjs)（含 `endOfLine: "lf"`）。
- **Stylelint**：根目录 [`.stylelintrc.json`](.stylelintrc.json)，扫描前端与包内样式。
- **Commitlint**：[`commitlint.config.cjs`](commitlint.config.cjs)，基于 Conventional Commits；**scope** 建议使用枚举之一：`rest-api`、`pc-portal`、`pc-admin`、`shared`、`request-core`、`js-bridge`、`web-monitor`、`repo`、`deps`、`docker`、`frontend`、`backend`。
- **lint-staged**：在 [`package.json`](package.json) 中配置，pre-commit 通过 Husky 调用。

提交示例：

```text
feat(rest-api): 增加评论分页参数校验
fix(pc-portal): 修正网关下 HMR 端口
chore(repo): 更新 README 与 OpenAPI
```

---

## API 契约与 Swagger

- **契约文件**：[`docs/openapi.yaml`](docs/openapi.yaml)（OpenAPI 3.0.3），应与 `apps/backend/rest-api/src/routes`、`schema`、`services` 等行为保持一致。
- **运行时**：
  - 契约原文：`GET /openapi.yaml`
  - Swagger UI：`GET /api-docs`（Helmet 对该路径关闭 CSP，避免 UI 脚本被拦截）
- **修改流程建议**：改接口实现 → 同步更新 `docs/openapi.yaml`（路径、参数、响应体、`description` 中与代码文件的交叉引用请指向 **`*.ts`** 源文件）→ 本地打开 `/api-docs` 或对 YAML 执行导入校验（如 Apifox / spectral）。

网关（Docker Nginx）通常将 `/openapi.yaml`、`/api-docs` 反代至 rest-api，与浏览器访问站点的端口一致（默认见下文）。

---

## Docker 开发 / 测试 / 生产

Compose 拉起 **MySQL 8.4（默认仅容器内）+ rest-api + pc-portal + Nginx**：后端通过 **`DB_HOST=mysql`** 在同一 Docker 网络内连库。**浏览器只访问一个端口**，默认 **`http://127.0.0.1:2026`**（环境变量 **`GATEWAY_HOST_PORT`**），由 `docker/nginx/gateway.dev.docker.conf` 分流——`/api`、`/uploads`、`/openapi.yaml`、`/api-docs`、`/health` 等到 **rest-api**，其余到容器内 **Vite（5173）**。网格内 rest-api 监听 **3000**；Inspector **9229** 映射在 **rest-api** 上。pc-portal 容器内配置 **`VITE_DEV_PROXY_TARGET`**、**`VITE_DEV_HMR_CLIENT_PORT`**（默认与 **`GATEWAY_HOST_PORT`** 一致）以保证经网关访问时的 API 与 HMR。

开发日志（仓库根 **`logs/`**，已在 `.gitignore`）：`logs/rest-api-dev.log`、`logs/pc-portal-dev.log`、`logs/mysql/error.log`（见 `docker/mysql-dev.cnf`）。

若需在宿主连接 MySQL 或宿主跑 `pnpm rest-api:dev`：按需取消 `docker/docker-compose.dev.yaml` 里 **`mysql`** 的 **`ports`** 注释。

```bash
cp .env.example .env.development   # 若尚未创建
pnpm docker:dev
```

带调试：`pnpm docker:dev:debug`。VS Code / Cursor 可使用 `.vscode/launch.json` 中的「Attach to Docker rest-api (9229)」附加调试。

停止开发栈：`pnpm docker:dev:down`。

### Docker 测试 / 生产

需要 **`.env.test`** / **`.env.production`**。结构与开发一致：**仅网关暴露宿端口**（默认 **2026**），`gateway.prod.docker.conf` + **pc-portal** 生产镜像（容器内 nginx **只托管 SPA**）。

```bash
pnpm docker:test
pnpm docker:prod
```

---

## 端到端测试（Playwright）

覆盖 **pc-portal**：首页频道与列表/空态、顶栏进入登录/注册、未登录访问 **`/mine`** 跳转登录并带 `redirect`（见 `e2e/pc-portal.spec.ts`、`playwright.config.ts`）。

- **默认（推荐）**：假定 Compose 已拉起网关（ **`pnpm docker:dev`** 或 **`pnpm docker:test`** 等），Playwright **不**内置启动 Node/Vite；**`baseURL`** 为 **`http://127.0.0.1:${PLAYWRIGHT_GATEWAY_PORT ?? GATEWAY_HOST_PORT ?? 2026}`**。数据库仅在 MySQL 容器内，由容器内 **rest-api** 连接。
- **宿主本机模式**：`pnpm e2e:local`（等价 **`PLAYWRIGHT_LOCAL_SERVERS=1`**），由 Playwright 拉起 **`pnpm rest-api:dev`** 与 **`pnpm pc-portal:dev`**；此时须让宿主进程能连上 MySQL（例如映射 **`3306:3306`** 且 **`DB_HOST=127.0.0.1`**）。
- 任意覆盖：`PLAYWRIGHT_BASE_URL`；仅改网关端口映射时也可用 **`PLAYWRIGHT_GATEWAY_PORT`**（优先于 **`GATEWAY_HOST_PORT`**）。

**`pnpm verify` / `pnpm test:all`** 包含 E2E，须先满足上述「默认」栈（网关可达）。**`pnpm e2e:docker`** 与 **`pnpm e2e`** 相同，仅为别名。

首跑浏览器：`pnpm e2e:install`（安装 Chromium）。报告目录 **`playwright-report/`**（默认忽略于 Git）。

---

## CODEOWNERS

默认评审人配置位于 [`.github/CODEOWNERS`](.github/CODEOWNERS)。

**使用前请将文件中所有 `@REPLACE_WITH_GITHUB_OWNER` 替换为真实 GitHub 用户或 `@组织/团队`**，否则平台无法指派有效的代码所有者。

可按模块拆分不同 owner（例如后端团队负责 `apps/backend/`，前端团队负责 `apps/frontend/`），在文件中增加或修改对应行即可。

---

## npm 镜像与安全

- 根目录 [`.npmrc`](.npmrc) 可能配置了 **registry 镜像**（如国内镜像）。若 CI 或海外环境安装失败，可为流水线单独指定 registry 或使用 `.npmrc` 分层策略。
- **切勿**将含密码、JWT 密钥的 `.env.*` 提交至 Git；模板与说明见 `.env.example`。若历史提交曾泄露真实密钥，须在目标环境**轮换**对应口令与密钥。

---

## 文档与契约文件

| 资源       | 路径                                       |
| ---------- | ------------------------------------------ |
| OpenAPI    | [`docs/openapi.yaml`](docs/openapi.yaml)   |
| 本文档     | [`README.md`](README.md)                   |
| 代码所有者 | [`.github/CODEOWNERS`](.github/CODEOWNERS) |

欢迎在 [`docs/openapi.yaml`](docs/openapi.yaml) 顶部 `info.description` 中维护与实现一致的变更说明（限流、校验、鉴权等）。
