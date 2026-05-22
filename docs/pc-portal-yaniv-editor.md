# pc-portal 富文本编辑器接入（Yaniv Editor）

本文说明本仓库 **pc-portal** 如何接入 [`@yanivjs/yaniv-editor`](https://github.com/YanivWang/yaniv-editor) v0.1.0+（Vue 3 + Tiptap 3），用于帖子新建/编辑与发布。

正文以 **HTML 字符串** 存储与展示；封面以专用段落嵌入正文（`data-post-cover`）；图片/视频嵌入正文 HTML。

---

## 概览

| 项             | 说明                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| **接入应用**   | `apps/frontend/pc-portal`                                                                                         |
| **编辑器包**   | `@yanivjs/yaniv-editor`（`pnpm file:` 本地链接，见该包 `package.json`）                                           |
| **发布页组件** | `PostEditorView.vue`                                                                                              |
| **路由**       | `/mine/editor`（新建）、`/mine/editor/:id`（编辑）                                                                |
| **页面布局**   | `meta.blankLayout: true` — 无站点顶栏，全视口沉浸式                                                               |
| **UI 框架**    | 站点壳层 **Element Plus**；**yaniv-editor 工具栏** 依赖 **Ant Design Vue**（peer，须安装并在 `main.ts` 全局注册） |
| **正文存储**   | HTML 字符串，入库前由 `rest-api` 白名单净化                                                                       |
| **封面**       | 保存前 `mergeCoverIntoContent` 写入 `<p data-post-cover="1">…</p>`                                                |
| **本地草稿**   | `localStorage`，键 `pc_portal_post_editor_draft:{id\|new}`                                                        |
| **详情展示**   | `PostDetailView` + DOMPurify 二次净化 + KaTeX 渲染数学公式                                                        |

```mermaid
flowchart LR
  subgraph portal [pc-portal]
    Entry["写文章 / 新建 / 编辑"]
    EditorPage["PostEditorView\nblankLayout"]
    Cover["postEditorCover"]
    Draft["postEditorDraft"]
    Yaniv["@yanivjs/yaniv-editor"]
    Entry --> EditorPage --> Yaniv
    EditorPage --> Cover
    EditorPage --> Draft
  end
  subgraph api [rest-api]
    ImgUpload["POST /api/uploads"]
    LargeUpload["POST /api/uploads/large/*"]
    Posts["POST/PUT /api/posts"]
    Sanitize["sanitizeHtmlContentForStorage"]
  end
  EditorPage -->|"uploadImage"| ImgUpload
  EditorPage -->|"uploadVideo"| LargeUpload
  Cover -->|"mergeCoverIntoContent"| Posts --> Sanitize
  Sanitize --> Detail["PostDetailView"]
```

---

## 接入清单（Checklist）

- [ ] yaniv-editor 源码已 `pnpm build` 产出 `dist/`
- [ ] `apps/frontend/pc-portal/package.json` 中 `file:` 路径在本机有效，`pnpm install` 无报错
- [ ] `package.json` 已声明 **`ant-design-vue`**、**`@ant-design/icons-vue`**（满足 yaniv-editor peer，勿仅依赖间接解析）
- [ ] [`main.ts`](../apps/frontend/pc-portal/src/main.ts) 注册 **Ant Design Vue** 并引入 `ant-design-vue/dist/reset.css`（在 `app.mount` 之前）
- [ ] 发布页引入 `@yanivjs/yaniv-editor/style.css` 与 `katex/dist/katex.min.css`
- [ ] 路由 meta 含 `blankLayout: true`
- [ ] 宿主容器遵循 `.yaniv-editor-host` 高度契约
- [ ] `YanivEditor` 使用 `v-if="!loading"`，避免 `initial-content` 与 Session 初始化竞态
- [ ] 后端 `rest-api` 与前台 `pc-portal` 均已启动

---

## 本地依赖与构建

`@yanivjs/yaniv-editor` 通过 **`apps/frontend/pc-portal/package.json`** 的 `file:` 字段链接到本机 yaniv-editor 源码目录（路径因开发者机器而异，勿写死到文档）。

yaniv-editor 的 **peerDependencies** 要求宿主安装 Ant Design Vue；pc-portal 须在 `dependencies` 中显式声明（当前为 `ant-design-vue@^4.2.6`、`@ant-design/icons-vue@^7.0.1`），并在 `main.ts` 全局 `app.use(Antd)`，否则编辑器工具栏组件无法渲染。

```bash
cd /path/to/yaniv-editor && pnpm build
cd /path/to/express-vue3-monorepo && pnpm install
```

### 启动联调

```bash
pnpm rest-api:dev
pnpm pc-portal:dev
```

登录后访问 **「写文章」** 或编辑器路由：

- 宿主 Vite：`http://localhost:5173/mine/editor`
- Docker 网关：`http://127.0.0.1:2026/mine/editor`（`GATEWAY_HOST_PORT` 默认 2026）

---

## 应用启动配置（main.ts）

pc-portal 同时使用 Element Plus（站点 UI）与 Ant Design Vue（yaniv-editor）。启动时先恢复登录会话，再注册 UI 库：

```ts
import Antd from "ant-design-vue";
import "ant-design-vue/dist/reset.css";
import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
// ...

const app = createApp(App);
app.use(createPinia());
app.use(router);
await useAuthStore().bootstrapSession();
app.use(Antd); // yaniv-editor 工具栏依赖
app.use(ElementPlus, { locale: zhCn });
app.mount("#app");
```

完整实现见 [`main.ts`](../apps/frontend/pc-portal/src/main.ts)。

---

## YanivEditor 配置模型

| 轴         | Prop                        | 帖子发布页取值          |
| ---------- | --------------------------- | ----------------------- |
| Phase      | `mode`                      | `"edit"`                |
| Preset     | `preset`                    | `"full"`                |
| Appearance | `appearance` + `color-mode` | `"default"` + `"light"` |
| Overrides  | `features`                  | `{ ai: false }`         |

[`PostEditorView.vue`](../apps/frontend/pc-portal/src/views/PostEditorView.vue)：

```vue
<YanivEditor
  v-if="!loading"
  ref="editorRef"
  mode="edit"
  preset="full"
  appearance="default"
  color-mode="light"
  :features="{ ai: false }"
  locale="zh-CN"
  :initial-content="editorInitialContent"
  :upload-image="handleUploadImage"
  :upload-video="handleUploadVideo"
/>
```

### 读写约定

| 操作     | 方式                                                                 |
| -------- | -------------------------------------------------------------------- |
| 加载正文 | `:initial-content` 传 HTML；编辑态经 `parseEditorContent` 剥离封面块 |
| 保存正文 | `mergeCoverIntoContent(getHTML(), coverUrl, title)` 后提交           |
| 空校验   | `isPostEditorBodyEmpty(html, plain)`（含图片/表格等非文本块）        |
| 延迟挂载 | `v-if="!loading"`                                                    |
| 模式切换 | `:mode` prop（禁止 `editor.setEditable()`）                          |

---

## 封面

封面不单独占 API 字段，而是写入正文首部专用段落，供列表 `cardCoverUrl` 读取首张图。

| 函数                    | 作用                                      |
| ----------------------- | ----------------------------------------- |
| `parseEditorContent`    | 加载时分离 `coverUrl` 与 `bodyHtml`       |
| `mergeCoverIntoContent` | 保存前插入 `<p data-post-cover="1">…</p>` |
| `stripPostCoverBlock`   | 去掉首部封面段                            |
| `validateCoverFile`     | JPG/PNG，最大 5MB                         |

实现：[`postEditorCover.ts`](../apps/frontend/pc-portal/src/utils/postEditorCover.ts)

---

## 本地草稿

| 项       | 说明                                                                    |
| -------- | ----------------------------------------------------------------------- |
| 存储键   | `pc_portal_post_editor_draft:{postId}` 或 `…:new`                       |
| 字段     | `title`、`categoryId`、`published`、`coverUrl`、`contentHtml`           |
| 读写 API | `readPostEditorDraft` / `writePostEditorDraft` / `clearPostEditorDraft` |

实现：[`postEditorDraft.ts`](../apps/frontend/pc-portal/src/utils/postEditorDraft.ts)

---

## 页面布局

宿主须满足 `.yaniv-editor-host` 高度契约（见 yaniv-editor `document-layout.css`），父级 flex 链每级 `min-height: 0`。

---

## 媒体上传

| 类型 | 接口                        | 编辑器 prop                 |
| ---- | --------------------------- | --------------------------- |
| 图片 | `POST /api/uploads`         | `:upload-image`             |
| 视频 | `POST /api/uploads/large/*` | `:upload-video`（必须提供） |
| 封面 | `POST /api/uploads`         | 发布页单独上传控件          |

实现：[`usePostMediaUpload.ts`](../apps/frontend/pc-portal/src/utils/usePostMediaUpload.ts)

---

## 正文安全

- 入库：[`content-safety.ts`](../apps/backend/rest-api/src/utils/content-safety.ts)
- 详情页：[`post-content-sanitize.ts`](../apps/frontend/pc-portal/src/utils/post-content-sanitize.ts)
- 数学公式：详情页对 `[data-type="math"]` 调用 `katex.render()`

---

## 路由与入口

| UI 入口              | 路由 name                    | path               |
| -------------------- | ---------------------------- | ------------------ |
| 顶栏「写文章」       | `editor-new`                 | `/mine/editor`     |
| 我的文章 → 新建/编辑 | `editor-new` / `editor-edit` | 同上               |
| 详情页 → 编辑        | `editor-edit`                | `/mine/editor/:id` |

---

## 关键源码

| 用途       | 路径                                                         |
| ---------- | ------------------------------------------------------------ |
| 发布页     | `apps/frontend/pc-portal/src/views/PostEditorView.vue`       |
| 封面       | `apps/frontend/pc-portal/src/utils/postEditorCover.ts`       |
| 本地草稿   | `apps/frontend/pc-portal/src/utils/postEditorDraft.ts`       |
| 路由       | `apps/frontend/pc-portal/src/router/index.ts`                |
| 媒体上传   | `apps/frontend/pc-portal/src/utils/usePostMediaUpload.ts`    |
| 详情净化   | `apps/frontend/pc-portal/src/utils/post-content-sanitize.ts` |
| 入库白名单 | `apps/backend/rest-api/src/utils/content-safety.ts`          |
| 详情展示   | `apps/frontend/pc-portal/src/views/PostDetailView.vue`       |

---

## 常见问题

### 工具栏布局异常

未安装或未全局注册 Ant Design Vue → 确认 `package.json` 含 `ant-design-vue` / `@ant-design/icons-vue`，且 `main.ts` 已 `app.use(Antd)` 并引入 `ant-design-vue/dist/reset.css`。

### 画布区域塌陷

检查 `.yaniv-editor-host` 与父级 `min-height: 0` flex 链。

### 编辑已有文章时正文为空

确认 `v-if="!loading"`，数据加载完再挂载编辑器。

### 媒体不显示

`src` 须为 `/uploads/...`，不能是外链或 Base64。

### 有图无字仍提示正文为空

确认使用 `isPostEditorBodyEmpty`，勿仅用 `getText().trim()`。

---

## 相关文档

- yaniv-editor：`docs/guide/getting-started.md`、`docs/api/yaniv-editor.md`
- [OpenAPI 契约](./openapi.yaml)
