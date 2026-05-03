import express from "express";
import { deleteUser, getOneUser, getUserById, getUsers, updateUser } from "../controllers/user.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const router = express.Router();

//负责用户管理的路由与 user controller中方法的绑定

router.get("/users", asyncHandler(getUsers, "获取用户列表失败"));
router.get("/users/:id", asyncHandler(getUserById, "获取用户失败"));
router.get("/getOneUser", asyncHandler(getOneUser, "获取用户失败"));
router.delete("/users/:id", asyncHandler(deleteUser, "删除用户失败"));
router.put("/users/:id", asyncHandler(updateUser, "更新用户失败"));

export default router;
