import rateLimit from "express-rate-limit";

import { fail } from "../utils/response.js";

// 探针路径不计入限流（skip）；若 health 路由挂在限流之前则通常不会命中本函数
function skipProbePaths(req: { path?: string }) {
  const p = req.path || "";
  return p === "/health" || p === "/ready";
}

export const globalRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10000, // 最大请求数（开发期批量导入等场景临时放宽；上线前请恢复合理阈值）
  skip: skipProbePaths,
  handler: (req, res) => {
    return fail(res, 429, "请求过于频繁，请稍后再试");
  },
});

export const authRateLimitMiddleware = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 60, // 登录/注册专用窗口；略高于常规交互上限，仍防暴力枚举
  handler: (req, res) => {
    return fail(res, 429, "请求过于频繁，请稍后再试");
  },
});
