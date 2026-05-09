---
name: pc-portal 博客门户
overview: 在 [apps/frontend/pc-portal](apps/frontend/pc-portal) 空壳上接入 Vue Router、Pinia、Element Plus、Axios，按 [docs/openapi.yaml](docs/openapi.yaml) 与 [apps/backend/rest-api](apps/backend/rest-api) 已提供的 `/api` 与静态 `/uploads` 搭建「公司门户 + 博客」：公开列表与分类筛选、详情与评论、登录用户的写作与我的文章；HTTP 层与后端 `{ code, msg, ...payload }` 扁平成功体对齐（与本仓库 request-core 默认假定的 `data` 嵌套不一致，首版在应用内自建 axios 封装）。视觉仍可按简书技术分区（顶栏一级 Tab + 简洁信息流）。
todos:
  - id: deps-catalog-proxy
    content: pc-portal 增加 vue-router、axios、element-plus、@element-plus/icons-vue（均可 catalog:）；在 pnpm-workspace catalog 补充 pinia 并列版本后再声明依赖；vite 代理 /api 与 /uploads；.env.example 与 VITE_API_BASE_URL
    status: pending
  - id: api-http-layer
    content: axios 实例（Bearer、401 行为、code===200 解析 msg + 扁平载荷）；按 openapi 拆分 auth/categories/posts/comments/uploads 模块（query 遵守 parentId/categoryId 互斥）
    status: pending
  - id: router-layout
    content: Vue Router 表与 requiresAuth 守卫；AppShell + 顶栏一级分类 Tab（GET /api/categories 根节点；与路由 query 同步）
    status: pending
  - id: public-posts
    content: 首页/列表分页、文章详情、图片同源路径 /uploads/…、评论列表只读
    status: pending
  - id: auth-mine-editor
    content: 登录注册页、Pinia auth（仅存 access token；后端无 refresh）、我的文章、富表单编辑器（叶子 categoryId、multipart 上传、published）、评论发表/删除（权限与 openapi 一致）
    status: pending
---

# pc-portal：Vue3 博客门户实施计划

## 现状与契约（以仓库当前代码为准）

- **前端应用**：[apps/frontend/pc-portal](apps/frontend/pc-portal) 与 [apps/frontend/pc-admin](apps/frontend/pc-admin) 均为 **Vue 单文件最小脚手架**（依赖目前仅有 `vue` + Vite 工具链）；[main.ts](apps/frontend/pc-portal/src/main.ts) 仅 `createApp(App)`，[vite.config.ts](apps/frontend/pc-portal/vite.config.ts) 已配置 `@` 与端口 `5173`，**尚未配置开发代理**。
- **Workspace 目录**：根 [package.json](package.json) 描述为 `rest-api` + `pc-portal` / `pc-admin`；本地开发可用 `pnpm pc-portal:dev` 与 `pnpm rest-api:dev`。
- **Catalog**（[pnpm-workspace.yaml](pnpm-workspace.yaml)）：已固定 `vue`、`vue-router`、`axios`、`element-plus`、`@element-plus/icons-vue` 等版本；**`pinia` 尚未列入 catalog**，实施时需在 catalog 增加一项再在 `pc-portal` 里 `pinia: "catalog:"`。
- **后端**：[apps/backend/rest-api/src/app.js](apps/backend/rest-api/src/app.js) 业务挂载 `/api`，静态文件 `/uploads` 与 API 同源；成功体为 **`{ code: 200, msg, ...任意扁平字段 }`**（见 [response.js](apps/backend/rest-api/src/utils/response.js)），错误 **`{ code, msg }`**。登录成功仅返回 **`token`**（无 refresh 端点）。
- **契约**：[docs/openapi.yaml](docs/openapi.yaml) 与 controller 一致：`/api/register`、`/api/login`、`/api/categories`、`/api/posts`、`/api/posts/{id}`（公开读已发布；未发布对匿名固定 404）、`/api/posts/mine/list`、`PUT/DELETE /api/posts/{id}`、`/api/uploads`、`/api/posts/{postId}/comments` 等。

**Workspace 包与本需求的衔接**

| 包                                             | 说明                                                                                                                                                                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [packages/request-core](packages/request-core) | UI 无关 axios 封装；成功响应类型假定 **`message` + 嵌套 `data`**，且内置 401 刷新逻辑。本仓库 **rest-api 使用 `msg` 且成功数据为扁平展开、且无 refresh**，**不能开箱即用 `HttpRequest.request()` 解包**；若未来统一后端响应形态或增加适配层再接入。 |
| [packages/shared](packages/shared)             | 含 `@express-vue3-monorepo/shared/request-pc`（Element Plus 的 `ElMessage` / 401 弹窗钩子）、hooks 等；依赖 **与后端一致的 token 与错误文案通路** 时在自建 axios 上 **仅复用 `createPcHooks` 这一类 UI 绑定** 即可，或继续直接用 `ElMessage`。      |

**门户范围**：仍建议只做 **公开读 + 登录写作/评论**；用户管理类 `/api/users*` 留给后续 **pc-admin**，避免与门户重叠。

## UI 参照（简书技术分区）

目标形态与原文档一致：

- **顶栏**：Logo + 横向一级 Tab，与 `GET /api/categories` 根节点对应。
- **主列表**：标题、摘要或首段、作者、分类、时间；分页字段与 openapi `pagination` 一致。
- **详情页**：`PostItem.content` 首版按纯文本或约定安全的 HTML/`white-space`；配图 `images[]` 使用 **`/uploads/` 前缀**（经 Vite 代理或同域）。
- **评论**：顶层分页倒序 + `replies`；行为以 openapi 为准（含 optionalAuth 的说明）。

## 依赖与工程配置

1. **依赖**：`vue-router`、`pinia`、`axios`、`element-plus`、`@element-plus/icons-vue`；版本优先 **pnpm catalog**（先补全 catalog 中的 `pinia`）。
2. **Element Plus**：入口注册 + `zh-cn` locale；样式策略与后续 pc-admin 对齐即可（全量或按需其一）。
3. **环境变量**：`VITE_API_BASE_URL`（如 `http://localhost:3000`）；可附 `.env.example`。
4. **Vite 开发代理**：为 **`/api`**、**`/uploads`** 转发到后端；可选转发 **`/openapi.yaml`** 便于本地对照。图片与上传 URL 使用同源相对路径，避免跨域。

## HTTP 层设计（与后端对齐）

成功响应形态示例：

```json
{ "code": 200, "msg": "获取文章列表成功", "posts": [], "pagination": {} }
```

拦截器建议逻辑：

- 请求：附加 `Authorization: Bearer <token>`（除注册/登录等白名单外可统一由实例或 per-request `withToken` 控制）。
- 响应：`code === 200` → `resolve` **剔除 `code`、`msg` 后的对象**（或按接口再取 `posts`/`post`/…）；否则 `ElMessage.error(msg)` 并 `reject`。
- **401**：后端无 refresh；**不要**照搬 request-core 的刷新重试。行为可为：清 token、弹窗或跳转 `/login`（可与 `shared/request-pc` 的交互方式类似，但不必强制引入 shared）。

可选：请求头带上 openapi 提到的 **`X-Request-Id`**（若后端中间件消费）。

## 分层与路由

| 层级                          | 职责                                                                                                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api/http.ts`             | `axios.create`、`baseURL`、`interceptors`；与上节解析规则一致。                                                                                                                                            |
| `src/api/*.ts`                | `auth`、`categories`、`posts`、`comments`、`uploads`；路径/query 与 openapi 一致。                                                                                                                         |
| `src/stores`                  | `auth`：`token` + `localStorage`（或 sessionStorage）；登出清空。**用户展示**：解析 JWT payload（`id`/`username`/`role` 等，以后端签发为准）或必要时 `GET /api/getOneUser?id=`。可选 `categories` 树缓存。 |
| `src/router`                  | `/`、`/posts/:id`、`/login`、`/register`、`/mine`、`/mine/editor`、`/mine/editor/:id`；`requiresAuth` + 守卫；列表筛选用 query `parentId` **或** `categoryId`。                                            |
| `src/views`、`src/components` | `AppShell`、列表、详情、评论、编辑器（`el-select` 叶子分类、`el-upload` → `POST /api/uploads`，`files` 字段）。                                                                                            |

## 页面与接口映射（核心）

- **首页 / 频道**：`GET /api/categories`；`GET /api/posts` + `page`/`limit` + 可选 `parentId` **或** `categoryId`。
- **详情**：`GET /api/posts/{id}`；配图与正文展示。
- **评论**：`GET /api/posts/{postId}/comments`；`POST` / `DELETE` 需 Bearer；删除按钮展示规则见 openapi（评论作者 / 文章作者 / `role === 1` 管理员）。
- **登录/注册**：`POST /api/register`、`POST /api/login`；注意 **单独更严限流**，错误用 `msg`。
- **我的文章**：`GET /api/posts/mine/list`。
- **创建/更新**：`POST /api/posts`；`PUT /api/posts/{id}` 至少一变种非空。
- **上传**：`POST /api/uploads`，`files`，单次最多 12、≤5MB、类型 jpeg/png/gif/webp；`urls` 写入 `images`（最多 24 条且须 `/uploads/` 前缀）。

## 风险与对齐点

- **UserItem 勿暴露 `password`**（openapi 已注明）。
- **富文本**：若使用 `v-html`，须与后端约定可信内容或后续 sanitize。
- **CORS**：开发靠代理；生产 `CORS_ORIGINS` 需含门户域名。
- **request-core / shared**：首版以 **应用内 axios** 为主；统一响应格式或适配层落地后再考虑抽 workspace 复用，避免两套语义并存。

## 建议迭代顺序

1. 依赖 + catalog 补 pinia + Router + Pinia + Element Plus + **代理** + **扁平成功体的 http 拦截器**。
2. 分类 Tab + 公开文章列表 + 分页 + query 联动。
3. 详情 + 评论列表；登录后发评/删评。
4. 登录/注册 + 我的文章 + CRUD + 上传 + `published`。
