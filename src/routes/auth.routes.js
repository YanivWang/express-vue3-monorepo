import express from "express";
import { login, register } from "../controllers/auth.controller.js";

const router = express.Router();

//负责注册和登录的路由与 auth controller中方法的绑定

router.post("/register", register);
router.post("/login", login);

export default router;
