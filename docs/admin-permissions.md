# 权限码—路由—业务对照（唯一清单）

> 权威清单与实现一致：`apps/backend/rest-api/src/rbac/permission-codes.ts` 中的 `PERMISSION_CODES`（共 **18** 项）。

> 超级管理员（`super_admin`）在库中绑定以下 **全部** code，`rbac.service` 亦按 slug 视为拥有全部权限码。其他角色必须显式勾选；默认拒绝（deny-by-default）。

## pc-admin 前端路由与侧栏

实现见 `apps/frontend/pc-admin/src/router/index.ts` 与 `views/layout/AdminLayout.vue`。路由守卫逻辑：

1. 未登录 → `/login`
2. 已登录但 `permissions` 中**无**任一 `admin.*` 前缀 → `/403`（`hasStaffEntry`）
3. 路由 `meta.permissions` 与侧栏 `can([...])` 使用 **`hasAnyPermission`（OR）**：满足所列权限**之一**即可

| 侧栏 / 页面           | 路由 path       | `meta.permissions`                                        |
| --------------------- | --------------- | --------------------------------------------------------- |
| 帖子管理              | `/posts`        | `admin.posts.read`                                        |
| 分类管理              | `/categories`   | `admin.categories.write` **或** `admin.categories.delete` |
| 注册用户              | `/portal-users` | `admin.portal_users.read`                                 |
| 评论管理              | `/comments`     | `admin.comments.read`                                     |
| 系统管理 → 角色管理   | `/system/roles` | `admin.roles.manage`                                      |
| 系统管理 → 管理员账号 | `/system/staff` | `admin.staff.read`                                        |

页内按钮（编辑帖子、删除、权限矩阵勾选等）另按具体权限码控制；危险权限标识见 `apps/frontend/pc-admin/src/utils/permissions.ts` 的 `isDangerousPermission()`。

---

## REST API 权限码对照

| 权限码                       | 路由 / 触发场景                                                                                   | Service 或行为说明                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `admin.posts.read`           | `GET /api/admin/posts`、`GET /api/admin/posts/:id`                                                | -                                                                                                   |
| `admin.posts.write`          | 非作者 `PUT /api/posts/:id`；`POST /api/posts` 且 body 同时带 `externalSource` + `externalKey` 时 | `canUpdatePost`、`createPost` 内 `assertUserPermission(..., "admin.posts.write")`                   |
| `admin.posts.delete`         | 非作者 `DELETE /api/posts/:id`                                                                    | `canDeletePost`                                                                                     |
| `admin.categories.read`      | 当前 **无** `requirePermission` 专属路由；权限已在 bootstrap 写入，可供角色矩阵勾选               | 公开类目树为 `GET /api/categories`（无需本码）                                                      |
| `admin.categories.write`     | `POST /api/categories`；`POST/PATCH /api/admin/categories/*`                                      | -                                                                                                   |
| `admin.categories.delete`    | `DELETE /api/admin/categories/:id`                                                                | `removeCategoryAdmin`                                                                               |
| `admin.portal_users.read`    | `GET /api/admin/portal-users`                                                                     | -                                                                                                   |
| `admin.portal_users.write`   | `PATCH /api/admin/portal-users/:id`                                                               | 目标用户须为门户角色 `user`                                                                         |
| `admin.portal_users.delete`  | `DELETE /api/admin/portal-users/:id`                                                              | -                                                                                                   |
| `admin.staff.read`           | `GET /api/admin/staff`、`GET /api/admin/staff-role-options`                                       | -                                                                                                   |
| `admin.staff.write`          | `PATCH /api/admin/staff/:id`（路由层 **与** 下列两项为 **OR**，满足其一即可进入）                 | `patchStaffUser` 内按修改字段再 `assertUserPermissions`：`write` / `assign_role` / `reset_password` |
| `admin.staff.assign_role`    | 同上                                                                                              | 请求体含 `roleId` 时需具备本码                                                                      |
| `admin.staff.reset_password` | 同上                                                                                              | 请求体含 `password` 时需具备本码                                                                    |
| `admin.staff.delete`         | `DELETE /api/admin/staff/:id`（撤销后台身份 / revoke）                                            | `revokeStaffUser`                                                                                   |
| `admin.staff.invite`         | `POST /api/admin/staff`                                                                           | `createStaffUser`                                                                                   |
| `admin.roles.manage`         | `GET/POST/PATCH/DELETE /api/admin/roles`、`GET /api/admin/permissions`                            | `adminRole.service`                                                                                 |
| `admin.comments.read`        | `GET /api/admin/comments`                                                                         | -                                                                                                   |
| `admin.comments.delete`      | `DELETE /api/posts/:postId/comments/:commentId`                                                   | `canDeleteComment`：评论作者 **或** 帖子作者 **或** 具备本码                                        |

说明：`PATCH /api/admin/staff/:id` 在 `admin.routes.ts` 上使用 `requirePermission([...], "any")`，故 `write` / `assign_role` / `reset_password` **任意一个**即可通过路由闸门；具体改哪些字段仍由 service 分项校验。

注释：`admin.posts.moderate` 等别名 **未采用**；请以本表与 `permission-codes.ts` 为准。
