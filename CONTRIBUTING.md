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
  - `pnpm lint`（带 `--max-warnings 0`：**warning 与 error 同样会让门禁失败**，不要用 eslint-disable 或放宽规则来消化告警）、`pnpm lint:style`、`pnpm format:check`
  - 提交前全套校验：`pnpm verify`（**先构建 workspace 包** → typecheck → lint → lint:style → format:check → 全仓单测 → 前端生产构建）
    - 第一步不是可有可无的：`packages/*` 的 `exports` 在 **`node` 条件**下指向 `dist`，后端（rest-api）无论运行还是跑测试都走这条路。
      不先构建，改了包源码的测试就会**悄悄跑在上一次编译的旧产物上**——CI 因为有独立的构建作业不会重现，本地却看不出来。
    - 前端两个 app 的组件测试则通过 [`scripts/vitest-workspace-src-alias.ts`](scripts/vitest-workspace-src-alias.ts)
      把 workspace 包解析到 **`src`**，与浏览器构建吃的是同一份源码——测试和线上不应该验证两个不同的产物。
- Docker：`pnpm docker:dev`、`pnpm docker:dev:down`、`pnpm docker:dev:debug`（详见 README「Docker 开发」）
- 单独跑某个包的测试：`pnpm --filter @express-vue3-monorepo/js-bridge test`（根 `pnpm test` 已并行覆盖全仓，单独跑仅用于调试）

## 组件重构与测试基线

前端两个 app 有一套组件行为测试（`apps/frontend/*/src/**/*.spec.ts`，测试台在 `src/test/`）。
它们的用途是**证明重构没有改变行为**，因此动结构时按这个顺序：

1. 先给要动的组件写行为基线，跑通；
2. 再拆分或重写；
3. 同一批断言**一行不改**地继续通过。

用例一律按「用户看到什么、点了什么」定位——可见文案、渲染结果、对外调用，
不碰组件内部的 ref 与方法。组件拆分会重排层级，但按钮上的字不会变，
基线因此才能跨拆分复用；反过来，断言一旦贴着内部实现写，拆分时就只能跟着改，
那就失去了作为证据的意义。

审阅重构类改动时，核对既有基线没有被改动或删除：

```bash
git diff --diff-filter=MD <重构前的提交> HEAD -- "*.spec.ts" "apps/frontend/*/src/test/"
```

输出为空即合规。**新增** spec 是鼓励的（上面第 1 步本来就会新增），
被禁止的是修改或删除既有断言——那等于把球门挪到球已经落地的地方。
所以这里过滤的是 `MD`（修改/删除）而不是全部改动。

## 前端环境变量

| App       | 文件                                       | 关键变量                                                                                                                                |
| --------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| pc-portal | `apps/frontend/pc-portal/.env.development` | `VITE_API_BASE_URL`、`VITE_DEV_PROXY_TARGET`、`VITE_DEV_HMR_CLIENT_PORT`；示例见 [`.env.example`](apps/frontend/pc-portal/.env.example) |
| pc-admin  | `apps/frontend/pc-admin/.env.development`  | 同上；网关/生产子路径另设 **`VITE_ADMIN_BASE=/pc-admin/`**（Compose 与生产镜像已注入）                                                  |

两 app 经 `@express-vue3-monorepo/shared` 的 `createAppPcHttp` 发请求。**访问令牌只存在于内存**（`createTokenStorage`），刷新页面必然丢失，会话延续由服务端下发的 HttpOnly 刷新令牌 Cookie（`evm_refresh_token`）承担：启动时 `restoreSession()` 静默换回访问令牌，401 时由 request-core 单飞刷新并重放。因此前端**不再有** `pc_portal_access_token` / `pc_admin_access_token` 这类 JS 可读的令牌 Cookie。

刷新令牌是**同源共享的一枚 Cookie**，所以刷新还经 **Web Locks** 串行化（`evm:auth:refresh`）：多标签页、或门户与管理端同时开着时，后到的那个会等前一个完成再发起，读到的已是轮换后的新 Cookie，于是变成连续的正常轮换，而不是让服务端靠「并发宽限窗口」去兜一次本可避免的竞态。锁不可用（Safari < 15.4、非安全上下文）时自动降级，仍由服务端窗口兜底——而服务端那一层的宽限窗口是**幂等重放**（原样返回同一枚继任令牌），并发轮换也由 `SET NX` 选出唯一赢家，所以降级路径不会让一枚令牌分叉成多条有效链。

应用启动时是否要发这次刷新，由 **`evm_has_session` 会话标记 Cookie** 决定（登录与每次刷新时随刷新 Cookie 一起下发，JS 可读、Path=`/`、值恒为 `1`）。没有它，匿名访客的首屏也会发一次注定 401 的刷新，而刷新档限流只统计失败请求，于是匿名流量会把桶吃满、把同一出口 IP 上真正登录的用户挡在门外。新增前端 app 时若自行实现会话恢复，这条门禁必须一并带上。

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

## 静态站的安全响应头

两个 SPA 由各自容器内的 Nginx 直出，helmet 管不到它们——而真正被浏览器当**文档**渲染的
恰恰是这两个站发出的 `index.html`。安全头因此写在 `docker/nginx/spa-security-headers.conf`，
由两份静态站配置 `include` 进来。

改这个文件时有两处容易踩：

1. **`add_header` 不会被继承进「自己也写了 `add_header` 的」子 location。**
   两个静态站都在 `location /assets/` 与 `location = /index.html` 里加了 Cache-Control，
   所以那两处必须各自再 `include` 一次，否则最常被请求的路径反而一个安全头都没有。
2. **CSP 只能靠真实镜像 + 真实浏览器验证。** 写错不会报错，只会让某个页面静默不工作。
   验证方式：`docker build -f docker/Dockerfile.pc-portal .` 起容器，
   逐页看控制台有没有 CSP 违规，并把 Web Worker（大文件上传的 MD5）、Word 导入这类
   非主路径也走一遍——它们恰好是最容易被 CSP 打断的地方。
