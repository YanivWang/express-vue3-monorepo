---
name: pc-portal 博客门户
overview: 在 [apps/frontend/pc-portal](apps/frontend/pc-portal) 空壳上接入 Vue Router、Pinia、Element Plus，HTTP 使用 workspace 已对齐 rest-api 的 `@express-vue3-monorepo/request-core` + `@express-vue3-monorepo/shared/request-pc`（默认 `{ code, msg, ...payload }` 解包、401 弹窗与 ElMessage），按 [docs/openapi.yaml](docs/openapi.yaml) 与 [apps/backend/rest-api](apps/backend/rest-api) 搭建「公司门户 + 博客」。视觉仍可按简书技术分区（顶栏一级 Tab + 简洁信息流）。
todos:
  - id: deps-catalog-proxy
    content: catalog 补充 pinia；pc-portal 增加 vue-router、pinia、element-plus、@element-plus/icons-vue、workspace 依赖 request-core 与 shared；vite 代理 /api 与 /uploads；.env.example 与 VITE_API_BASE_URL
    status: pending
  - id: api-http-layer
    content: createPcHttp + 默认 rest-api 扁平载荷解包（Promise 已不含 code/msg，仅业务字段）；封装模块与 openapi 一致；列表/我的文章等 query 遵守 parentId 与 categoryId 互斥、page/limit 约定；401 无 refresh 走 preset 清 token+跳转
    status: pending
  - id: router-layout
    content: Vue Router 表与 requiresAuth 守卫；AppShell + 顶栏一级分类 Tab（GET /api/categories 根节点；与路由 query 同步）
    status: pending
  - id: public-posts
    content: 首页/列表分页、文章详情、图片同源路径 /uploads/…、评论列表只读
    status: pending
  - id: auth-mine-editor
    content: 登录注册页、Pinia auth（仅存 access JWT，与 TokenStorage 同步；不实现 refresh token）、我的文章、编辑器（叶子 categoryId、multipart 上传、published）、评论发表/删除（权限与 openapi 一致）
    status: pending
---

# pc-portal：Vue3 博客门户实施计划

## 现状与契约（以仓库当前代码为准）

- **前端应用**：[apps/frontend/pc-portal](apps/frontend/pc-portal) 与 [apps/frontend/pc-admin](apps/frontend/pc-admin) 均为 **Vue 最小脚手架**（依赖目前仅有 `vue` + Vite 工具链）；[vite.config.ts](apps/frontend/pc-portal/vite.config.ts) 已配置 `@` 与端口 `5173`，**尚未配置开发代理**。
- **Workspace 目录**：根 [package.json](package.json) 为 `rest-api` + `pc-portal` / `pc-admin`；本地可用 `pnpm pc-portal:dev` 与 `pnpm rest-api:dev`。
- **Catalog**（[pnpm-workspace.yaml](pnpm-workspace.yaml)）：已有 `vue`、`vue-router`、`axios`、`element-plus`、`@element-plus/icons-vue` 等；**`pinia` 仍未列入 catalog**，实施时先在 catalog 增加版本再在 `pc-portal` 声明 `pinia: "catalog:"`。
- **后端**：[apps/backend/rest-api](apps/backend/rest-api) 业务挂载 `/api`，静态 `/uploads`；成功体 **`{ code: 200, msg, ...扁平载荷 }`**，错误 **`{ code, msg }`**；登录仅返回 **`token`**（无 refresh 端点）。
- **契约**：[docs/openapi.yaml](docs/openapi.yaml) 与 controller 一致：`/api/register`、`/api/login`、`/api/categories`、`/api/posts`、`/api/posts/{id}`、`/api/posts/mine/list`、`PUT/DELETE /api/posts/{id}`、`/api/uploads`、`/api/posts/{postId}/comments` 等。

**Workspace 包与本需求（已对齐 rest-api）**

| 包                                             | 说明                                                                                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [packages/request-core](packages/request-core) | 默认 **`responseStyle: 'rest-api'`**：校验 `code === 200`，**解包剔除 `code`/`msg` 后的扁平对象**；HTTP 错误体优先读 **`msg`**；无 refresh token 时 **401 不会走刷新**，直接触发 `onUnauthorized`（可与 shared preset 联动）。 |
| [packages/shared](packages/shared)             | **`createPcHttp`**：绑定 `createPcHooks`（ElMessage / 401 确认框跳转登录）与可选 Loading；**`@express-vue3-monorepo/shared/types`** 中 **`LoginResult`** 等为 **`{ token }`** 等，与当前登录接口解包结果一致。                 |

**门户范围**：公开读 + 登录写作/评论；`/api/users*` 等管理面留给 **pc-admin**。

## UI 参照（简书技术分区）

- **顶栏**：Logo + 一级 Tab ← `GET /api/categories` 根节点。
- **主列表**：标题、摘要、作者、分类、时间；分页与 openapi `pagination` 一致。
- **详情**：`PostItem.content` 首版纯文本或约定安全展示；`images[]` 使用 **`/uploads/`**（代理后同源）。
- **评论**：顶层倒序分页 + `replies`。

## 依赖与工程配置

1. **依赖**：`vue-router`、`pinia`、`element-plus`、`@element-plus/icons-vue`、**`@express-vue3-monorepo/request-core`**、**`@express-vue3-monorepo/shared`**（`axios` 由上述包传递）；版本与 **catalog / workspace:\*** 一致。
2. **Element Plus**：入口注册 + `zh-cn` locale。
3. **环境变量**：`VITE_API_BASE_URL`；可附 `.env.example`。
4. **Vite 代理**：`/api`、`/uploads` 指向后端（`rest-api` 默认端口见 [env.js](apps/backend/rest-api/src/env.js) 的 `PORT`，一般为 **3000**）；可选 `/openapi.yaml`。
5. **baseURL 与代理（二选一，勿混用）**：
   - **同源代理**：`baseURL` 置空字符串，`http` 请求 path 写 **`/api/...`**（走 Vite 代理到后端）；`VITE_API_BASE_URL` 可省略或仅作文档。
   - **直连后端**：`baseURL` 为 `http://localhost:3000`（或部署 URL），此时开发期可不配代理，但须处理 **CORS**（或仍配代理只作静态）。

## HTTP 层设计

**推荐**：`createPcHttp({ baseURL: import.meta.env.VITE_API_BASE_URL ?? '', tokenKey: '...', loginPath: '/login', onLogout: () => authStore.clear() })`，在应用侧再 `export const http = createPcHttp(...)`。

- **请求**：`withToken` 默认附带 Bearer（注册/登录等可用 **`withToken: false`**，与 `RequestConfig` 一致）。
- **响应**：业务方法 **`http.get/post/...` 的 Promise 已解包**，例如列表为 **`{ posts, pagination }`**，登录为 **`{ token }`**，与 openapi 文档对照即可。
- **401**：预设会清 token、可选 `onLogout`、**`window.location.href` 全页跳转**登录；若要保持 SPA 内 `router.push`，需自写 `hooks.onUnauthorized` 等覆盖默认行为。无 refresh 时勿配置无效 `onRefreshToken`。
- **上传**：`POST /api/uploads` 使用 **`FormData`** + 字段名 **`files`**；axios 对 `FormData` 会处理 boundary，但若在单次请求里 **强行覆盖 `Content-Type`** 会导致失败，需留意封装层。

若需对接 **嵌套 `{ code, message, data }`** 的旧网关，可在 `createPcHttp` 传入 **`responseStyle: 'nested-data'`**（本仓库 **rest-api 不需要**）。

可选：请求头 **`X-Request-Id`**（见 openapi）。

## 分层与路由

| 层级                                | 职责                                                                                                                                                                                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api/http.ts`（或 `client.ts`） | 导出 `createPcHttp` 单例、`TokenStorage` 与 `http`                                                                                                                                                                                                                         |
| `src/api/*.ts`                      | `auth`、`categories`、`posts`、`comments`、`uploads`；URL/query 与 openapi 一致                                                                                                                                                                                            |
| `src/stores`                        | `auth`：**单一事实来源**（建议以 `TokenStorage`/cookie 或仅 Pinia 择一封装，避免双份 token）；展示用 JWT 解析（字段以后端签发为准）或 **`GET /api/getOneUser?id=`**（**需 Bearer**，见 openapi）；列表/详情中 **`author` 已返回时往往不必再拉用户信息**。可选 `categories` |
| `src/router`                        | `/`、`/posts/:id`、`/login`、`/register`、`/mine`、`/mine/editor`、`/mine/editor/:id`；`requiresAuth`；列表筛选 `parentId` **或** `categoryId`                                                                                                                             |
| `src/views`、`src/components`       | `AppShell`、列表、详情、评论、编辑器（`el-upload` → `POST /api/uploads`，字段名 `files`）                                                                                                                                                                                  |

## 页面与接口映射（核心）

- **首页 / 频道**：`GET /api/categories`；`GET /api/posts` + `page`/`limit` + 可选 `parentId` **或** `categoryId`。
- **详情**：`GET /api/posts/{id}`。
- **评论**：`GET` 公开（openapi 为可选 JWT，一般可不带；若将来要做登录态差异可统一带 Bearer）；`POST`/`DELETE` 需 Bearer；删除权限见 openapi。
- **登录/注册**：`POST /api/register`、`POST /api/login`；**单独限流**，错误文案为 **`msg`**（已由核心层写入 `NormalizedError.message`）。**注册成功不返回 token**，需引导用户再调登录或自动跳转登录页。
- **我的文章**：`GET /api/posts/mine/list`。
- **创建/更新**：`POST /api/posts`；`PUT /api/posts/{id}` 至少一字段非空。
- **上传**：`POST /api/uploads`，`multipart` 字段 `files`；`urls` → `images`（规则见 openapi）。

## 风险与对齐点

- **UserItem 勿暴露 `password`**。
- **富文本 / `v-html`**：须约定可信源或 sanitize。
- **CORS**：开发靠代理；生产配置 `CORS_ORIGINS`。
- **`@express-vue3-monorepo/shared` 的 peer**：除文档已列依赖外，若从 shared 引用还需 **`@vueuse/core`** 的模块，须在 `pc-portal` 安装 peer 版本（与 [shared/package.json](packages/shared/package.json) 一致）。
- **限流与用户提示**：注册/登录接口限流更严，UI 需直接展示后端 **`msg`**（勿写死猜错原因）。

## 建议迭代顺序

1. catalog 补 pinia + 依赖 + Router + Pinia + Element Plus + **`createPcHttp`** + 代理 + `baseURL`。
2. 分类 Tab + 公开列表 + 分页 + query。
3. 详情 + 评论列表；登录后发评/删评。
4. 登录/注册 + 我的文章 + CRUD + 上传 + `published`。
