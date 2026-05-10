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
