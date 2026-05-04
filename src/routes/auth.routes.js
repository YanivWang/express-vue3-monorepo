import express from "express";
import { login, register } from "../controllers/auth.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const router = express.Router();

//负责注册和登录的路由与 auth controller中方法的绑定
//router.post 的第二个参数 必须是路由处理函数
//而 Express 里这种函数和中间件形状一样，都是 (req, res, next) => { ... }，所以有时也叫「中间件」

//对。在 Express 里，路由里写的处理函数和 中间件 用的是同一套约定：都可以是 (req, res, next) => { ... }
router.post("/register", asyncHandler(register, "注册失败"));
router.post("/login", asyncHandler(login, "登录失败"));

export default router;
