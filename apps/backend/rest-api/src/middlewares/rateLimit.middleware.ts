/**
 * 限流阈值。
 *
 * 历史问题：阈值曾以字面量硬编码在代码里，全局窗口是「15 分钟 10000 次」，
 * 并留有「开发期临时放宽；上线前请恢复合理阈值」的注释——也就是说，一个明知不适合生产的值
 * 被直接发布到了生产，且只能靠改代码重新发版才能调整。
 *
 * 现在阈值来自环境变量，默认取生产安全值；开发/测试需要放宽或关闭时改环境即可，不必动代码。
 */
import rateLimit from "express-rate-limit";

import { RATE_LIMIT } from "../env.js";
import { fail } from "../utils/response.js";

// /health、/ready：当前 app.ts 将探针挂在全局限流之前，一般不会执行到此 skip；保留以便调整挂载顺序或复用本中间件时不误伤探针
function skipProbePaths(req: { path?: string }) {
  const p = req.path || "";
  return p === "/health" || p === "/ready";
}

export const globalRateLimitMiddleware = rateLimit({
  windowMs: RATE_LIMIT.globalWindowMs,
  limit: RATE_LIMIT.globalMax,
  skip: skipProbePaths,
  handler: (_req, res) => {
    return fail(res, 429, "请求过于频繁，请稍后再试");
  },
});

export const authRateLimitMiddleware = rateLimit({
  windowMs: RATE_LIMIT.authWindowMs,
  limit: RATE_LIMIT.authMax,
  handler: (_req, res) => {
    return fail(res, 429, "请求过于频繁，请稍后再试");
  },
});
