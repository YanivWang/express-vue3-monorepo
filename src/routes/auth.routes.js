import express from "express";
import { login, register } from "../controllers/auth.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const router = express.Router();

//负责注册和登录的路由与 auth controller中方法的绑定

router.post("/register", asyncHandler(register, "注册失败"));
router.post("/login", asyncHandler(login, "登录失败"));

export default router;
