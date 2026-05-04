import express from "express";
import { deleteUser, getOneUser, getUserById, getUsers, updateUser } from "../controllers/user.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { deleteUserSchema, getOneUserSchema, getUserSchema, getUsersSchema, updateUserSchema } from "../schema/user.schema.js";

const router = express.Router();

//注册路由中间件
//保护路由，需要登录才能访问(这里只保护user相关路由)
router.use(authMiddleware); // 路由级别中间件

//负责用户管理的路由与 user controller中方法的绑定
router.get("/users", validate(getUsersSchema), asyncHandler(getUsers, "获取用户列表失败"));
router.get("/users/:id", validate(getUserSchema), asyncHandler(getUserById, "获取用户失败"));
router.get("/getOneUser", validate(getOneUserSchema), asyncHandler(getOneUser, "获取用户失败"));
router.delete("/users/:id", validate(deleteUserSchema), asyncHandler(deleteUser, "删除用户失败"));
router.put("/users/:id", validate(updateUserSchema), asyncHandler(updateUser, "更新用户失败"));

export default router;
