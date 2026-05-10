import express from "express";

import { login, register } from "../controllers/auth.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
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

export default router;
