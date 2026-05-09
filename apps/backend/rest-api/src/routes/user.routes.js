import express from "express";
import {
  deleteUser,
  getOneUser,
  getUserById,
  getUsers,
  updateUser,
} from "../controllers/user.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  deleteUserSchema,
  getOneUserSchema,
  getUserSchema,
  getUsersSchema,
  updateUserSchema,
} from "../schema/user.schema.js";

const router = express.Router();

// 勿使用 router.use(authMiddleware)：本 router 与其它业务路由共用挂载前缀 `/api`，Express 会依次
// 进入各子路由；顶层 router.use 会对「进入本 router 且尚未匹配的请求」先执行鉴权，从而在 posts /
// categories 等公开接口之前错误返回 401。仅在下列路径上逐个挂载 authMiddleware。
router.get(
  "/users",
  authMiddleware,
  validate(getUsersSchema),
  asyncHandler(getUsers, "获取用户列表失败"),
);
router.get(
  "/users/:id",
  authMiddleware,
  validate(getUserSchema),
  asyncHandler(getUserById, "获取用户失败"),
);
router.get(
  "/getOneUser",
  authMiddleware,
  validate(getOneUserSchema),
  asyncHandler(getOneUser, "获取用户失败"),
);
router.delete(
  "/users/:id",
  authMiddleware,
  validate(deleteUserSchema),
  asyncHandler(deleteUser, "删除用户失败"),
);
router.put(
  "/users/:id",
  authMiddleware,
  validate(updateUserSchema),
  asyncHandler(updateUser, "更新用户失败"),
);

export default router;
