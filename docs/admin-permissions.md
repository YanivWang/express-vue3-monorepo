# 权限码—路由—业务对照（唯一清单）

> 超级管理员（`super_admin`）在库中绑定以下 **全部** code，代码层亦按 slug 通配放行。其他角色必须显式勾选；默认拒绝（deny-by-default）。

| 权限码                       | 主要路由                                                               | Service 二次校验示例                                 |
| ---------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| `admin.posts.read`           | `GET /api/admin/posts`, `GET /api/admin/posts/:id`                     | -                                                    |
| `admin.posts.write`          | 非 owner 对他人帖 `PUT /api/posts/:id`（与作者编辑并存）；外链幂等写入 | `assertUserPermission` external key、`canUpdatePost` |
| `admin.posts.delete`         | 非 owner 删除 `DELETE /api/posts/:id`                                  | `canDeletePost`                                      |
| `admin.categories.read`      | （规划中仅读类目；当前树用公开 `GET /api/categories`）                 | -                                                    |
| `admin.categories.write`     | `POST /api/categories`、`POST/PATCH /api/admin/categories/*`           | -                                                    |
| `admin.categories.delete`    | `DELETE /api/admin/categories/:id`                                     | `removeCategoryAdmin`                                |
| `admin.portal_users.read`    | `GET /api/admin/portal-users`                                          | -                                                    |
| `admin.portal_users.write`   | `PATCH /api/admin/portal-users/:id`                                    | portal 校验 slug=`user`                              |
| `admin.portal_users.delete`  | `DELETE /api/admin/portal-users/:id`                                   | -                                                    |
| `admin.staff.read`           | `GET /api/admin/staff`、`GET /api/admin/staff-role-options`            | -                                                    |
| `admin.staff.write`          | `PATCH` 中非密码字段                                                   | service 字段级                                       |
| `admin.staff.assign_role`    | `PATCH` 中含 `roleId`                                                  | service                                              |
| `admin.staff.reset_password` | `PATCH` 中含 `password`                                                | service                                              |
| `admin.staff.delete`         | `DELETE /api/admin/staff/:id`（实为降级 revoke）                       | `revokeStaffUser`                                    |
| `admin.staff.invite`         | `POST /api/admin/staff`                                                | `createStaffUser`                                    |
| `admin.roles.manage`         | `GET/POST/PATCH/DELETE /api/admin/roles`、`GET /api/admin/permissions` | `adminRole.service`                                  |
| `admin.comments.read`        | `GET /api/admin/comments`                                              | -                                                    |
| `admin.comments.delete`      | `DELETE /api/posts/:postId/comments/:id`（作者/楼主/RBAC）             | `canDeleteComment`                                   |

注释：`admin.posts.moderate` 等别名 **未采用**；请以本表为准。
