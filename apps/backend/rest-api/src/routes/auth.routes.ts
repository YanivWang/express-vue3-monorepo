import express from "express";

import { login, logout, refresh, register } from "../controllers/auth.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware.js";
import {
  authRateLimitMiddleware,
  refreshRateLimitMiddleware,
} from "../middlewares/rateLimit.middleware.js";
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
 * 限流用刷新专用的那一档（只统计失败），不与登录共用——理由见 rateLimit.middleware.ts。
 */
router.post("/auth/refresh", refreshRateLimitMiddleware, asyncHandler(refresh, "刷新登录状态失败"));

/**
 * 登出。用 optionalAuth 而不是 authMiddleware：**登出不该需要一枚还没过期的访问令牌**。
 *
 * 挂 authMiddleware 时，访问令牌一过期（默认 15 分钟）登出就返回 401，
 * 刷新令牌家族原封不动地活着——用户以为退了，服务端的会话还能再续 7 天。
 * 浏览器端因为 401 拦截器会先静默刷新再重放，通常看不出来；
 * 但直连 API 的客户端、以及「启动时会话恢复恰好失败、Cookie 其实有效」的情况就是静默失效。
 *
 * 撤销真正依赖的是 Cookie 里那枚刷新令牌（且要求持有它的 secret），不是 Bearer；
 * Bearer 在这里只多干一件事：把当前这枚访问令牌的 jti 拉黑。有就做，没有就跳过。
 *
 * 这不构成 CSRF 面：刷新 Cookie 是 SameSite=Strict 的，跨站请求根本不携带它，
 * 于是「跨站强制登出」打过来也只是一次什么都没撤销的空操作。
 */
router.post("/logout", optionalAuthMiddleware, asyncHandler(logout, "退出登录失败"));

export default router;
