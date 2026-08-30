import express from "express";

import { login, logout, refresh, register } from "../controllers/auth.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { authRateLimitMiddleware } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { registerSchema, loginSchema } from "../schema/auth.schema.js";

const router = express.Router();

router.post(
  "/register",
  authRateLimitMiddleware,
  validate(registerSchema),
  asyncHandler(register, "注册失败"),
);

router.post(
  "/login",
  authRateLimitMiddleware,
  validate(loginSchema),
  asyncHandler(login, "登录失败"),
);

/**
 * 刷新访问令牌。不经 authMiddleware：调用它的前提正是访问令牌已经过期，
 * 身份由 HttpOnly Cookie 里的刷新令牌承担。
 * 复用登录/注册的限流窗口，避免被拿来做刷新令牌枚举。
 */
router.post("/auth/refresh", authRateLimitMiddleware, asyncHandler(refresh, "刷新登录状态失败"));

router.post("/logout", authMiddleware, asyncHandler(logout, "退出登录失败"));

export default router;
