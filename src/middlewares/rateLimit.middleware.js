import rateLimit from "express-rate-limit";
import { fail } from "../utils/response.js";

export const globalRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最大请求数
  handler: (req, res, next) => {
    return fail(res, 429, "请求过于频繁，请稍后再试");
  },
});

export const authRateLimitMiddleware = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 5, // 最大请求数
  handler: (req, res, next) => {
    return fail(res, 429, "请求过于频繁，请稍后再试");
  },
});
