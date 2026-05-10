import express from "express";

import {
  deleteAdminCategory,
  patchAdminCategory,
  postAdminCategoryLeaf,
  postAdminCategoryRoot,
} from "../controllers/adminCategories.controller.js";
import { listAdminComments } from "../controllers/adminComments.controller.js";
import {
  deletePortalUser,
  listPortalUsers,
  patchPortalUser,
} from "../controllers/adminPortalUsers.controller.js";
import { getAdminPost, listAdminPosts } from "../controllers/adminPosts.controller.js";
import {
  deleteRole,
  listPermissions,
  listRoles,
  patchRole,
  postRole,
} from "../controllers/adminRoles.controller.js";
import {
  deleteStaffUser,
  getStaffRoleCatalog,
  listStaffUsers,
  patchStaffUser,
  postStaffUser,
} from "../controllers/adminStaff.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  adminCommentsListSchema,
  adminCreateCategoryLeafSchema,
  adminCreateCategoryRootSchema,
  adminDeleteCategorySchema,
  adminGetPostSchema,
  adminListPostsSchema,
  adminPatchCategorySchema,
  adminPortalUserDeleteSchema,
  adminPortalUserPatchSchema,
  adminPortalUsersListSchema,
  adminRolesCreateSchema,
  adminRolesDeleteSchema,
  adminRolesPatchSchema,
  adminStaffCreateSchema,
  adminStaffDeleteSchema,
  adminStaffListSchema,
  adminStaffPatchSchema,
} from "../schema/admin.schema.js";

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/admin/posts",
  requirePermission(["admin.posts.read"], "all"),
  validate(adminListPostsSchema),
  asyncHandler(listAdminPosts, "获取管理端文章列表失败"),
);
router.get(
  "/admin/posts/:id",
  requirePermission(["admin.posts.read"], "all"),
  validate(adminGetPostSchema),
  asyncHandler(getAdminPost, "获取管理端文章详情失败"),
);

router.post(
  "/admin/categories/roots",
  requirePermission(["admin.categories.write"], "all"),
  validate(adminCreateCategoryRootSchema),
  asyncHandler(postAdminCategoryRoot, "创建一级分类失败"),
);
router.post(
  "/admin/categories/leaves",
  requirePermission(["admin.categories.write"], "all"),
  validate(adminCreateCategoryLeafSchema),
  asyncHandler(postAdminCategoryLeaf, "创建二级分类失败"),
);
router.patch(
  "/admin/categories/:id",
  requirePermission(["admin.categories.write"], "all"),
  validate(adminPatchCategorySchema),
  asyncHandler(patchAdminCategory, "更新分类失败"),
);
router.delete(
  "/admin/categories/:id",
  requirePermission(["admin.categories.delete"], "all"),
  validate(adminDeleteCategorySchema),
  asyncHandler(deleteAdminCategory, "删除分类失败"),
);

router.get(
  "/admin/portal-users",
  requirePermission(["admin.portal_users.read"], "all"),
  validate(adminPortalUsersListSchema),
  asyncHandler(listPortalUsers, "获取注册用户列表失败"),
);
router.patch(
  "/admin/portal-users/:id",
  requirePermission(["admin.portal_users.write"], "all"),
  validate(adminPortalUserPatchSchema),
  asyncHandler(patchPortalUser, "更新注册用户失败"),
);
router.delete(
  "/admin/portal-users/:id",
  requirePermission(["admin.portal_users.delete"], "all"),
  validate(adminPortalUserDeleteSchema),
  asyncHandler(deletePortalUser, "删除注册用户失败"),
);

router.get(
  "/admin/staff-role-options",
  requirePermission(["admin.staff.read"], "all"),
  asyncHandler(getStaffRoleCatalog, "获取可绑定后台角色失败"),
);

router.get(
  "/admin/staff",
  requirePermission(["admin.staff.read"], "all"),
  validate(adminStaffListSchema),
  asyncHandler(listStaffUsers, "获取职员列表失败"),
);
router.post(
  "/admin/staff",
  requirePermission(["admin.staff.invite"], "all"),
  validate(adminStaffCreateSchema),
  asyncHandler(postStaffUser, "创建后台账号失败"),
);
router.patch(
  "/admin/staff/:id",
  requirePermission(
    ["admin.staff.write", "admin.staff.assign_role", "admin.staff.reset_password"],
    "any",
  ),
  validate(adminStaffPatchSchema),
  asyncHandler(patchStaffUser, "更新职员失败"),
);
router.delete(
  "/admin/staff/:id",
  requirePermission(["admin.staff.delete"], "all"),
  validate(adminStaffDeleteSchema),
  asyncHandler(deleteStaffUser, "撤销职员失败"),
);

router.get(
  "/admin/permissions",
  requirePermission(["admin.roles.manage"], "all"),
  asyncHandler(listPermissions, "获取权限定义失败"),
);
router.get(
  "/admin/roles",
  requirePermission(["admin.roles.manage"], "all"),
  asyncHandler(listRoles, "获取角色列表失败"),
);
router.post(
  "/admin/roles",
  requirePermission(["admin.roles.manage"], "all"),
  validate(adminRolesCreateSchema),
  asyncHandler(postRole, "创建角色失败"),
);
router.patch(
  "/admin/roles/:id",
  requirePermission(["admin.roles.manage"], "all"),
  validate(adminRolesPatchSchema),
  asyncHandler(patchRole, "更新角色失败"),
);
router.delete(
  "/admin/roles/:id",
  requirePermission(["admin.roles.manage"], "all"),
  validate(adminRolesDeleteSchema),
  asyncHandler(deleteRole, "删除角色失败"),
);

router.get(
  "/admin/comments",
  requirePermission(["admin.comments.read"], "all"),
  validate(adminCommentsListSchema),
  asyncHandler(listAdminComments, "获取管理端评论列表失败"),
);

export default router;
