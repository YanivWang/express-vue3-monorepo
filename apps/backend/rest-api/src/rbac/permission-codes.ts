/** 全局权限码清单（与路由、service 二次校验一致）；超级管理员角色在库中绑定全部以下 code。 */
export const PERMISSION_CODES = [
  "admin.posts.read",
  "admin.posts.write",
  "admin.posts.delete",
  "admin.categories.read",
  "admin.categories.write",
  "admin.categories.delete",
  "admin.portal_users.read",
  "admin.portal_users.write",
  "admin.portal_users.delete",
  "admin.staff.read",
  "admin.staff.write",
  "admin.staff.assign_role",
  "admin.staff.reset_password",
  "admin.staff.delete",
  "admin.staff.invite",
  "admin.roles.manage",
  "admin.comments.read",
  "admin.comments.delete",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const ROLE_SLUG_SUPER_ADMIN = "super_admin";
export const ROLE_SLUG_USER = "user";
export const ROLE_SLUG_MODERATOR = "moderator";

/** AND：须同时拥有所列权限；OR：满足任一 */
export type PermissionMode = "all" | "any";
