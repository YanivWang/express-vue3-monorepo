/**
 * 限流。
 *
 * 历史问题一：阈值曾以字面量硬编码在代码里，全局窗口是「15 分钟 10000 次」，
 * 并留有「开发期临时放宽；上线前请恢复合理阈值」的注释——也就是说，一个明知不适合生产的值
 * 被直接发布到了生产，且只能靠改代码重新发版才能调整。
 * 现在阈值来自环境变量，默认取生产安全值；开发/测试需要放宽或关闭时改环境即可，不必动代码。
 *
 * 历史问题二：计数放在进程内存里。单副本时看不出问题，一旦按部署文档横向扩容，
 * 「1 分钟 10 次」就变成了「每副本 1 分钟 10 次」——限流阈值被副本数悄悄放大，
 * 且同一个攻击者只要被负载均衡打散，实际能打出的量级完全不受控。
 * Redis 本就在依赖里（黑名单、RBAC 快照、刷新令牌都在用），因此计数改为共享存储，
 * 所有副本看到同一个桶。
 */
import rateLimit, { type Logger, type Store } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

import { RATE_LIMIT } from "../env.js";
import { connectRedis, redis } from "../redis.js";
import { logger, serializeError } from "../utils/logger.js";
import { fail } from "../utils/response.js";

/** rate-limit-redis 期望的返回形状；node-redis 的 ReplyUnion 更宽，用泛型参数收窄，避免断言 */
type RedisRawReply = boolean | number | string | (boolean | number | string)[];

/**
 * 每档限流各自的 key 前缀，否则三个桶会在 Redis 里互相串台。
 * 前缀也标明来源，便于在 redis-cli 里按 `rl:*` 观察实时计数。
 *
 * 发命令前先确保连接：RedisStore 在中间件构造时就会 `SCRIPT LOAD`，且**把那个 promise 缓存下来**——
 * 一旦它因为「客户端尚未连接」而失败，之后每次计数都会拿到同一个已拒绝的 promise，
 * 限流就此永久失效（且因为 passOnStoreError 只会安静地放行）。server.ts 已改为先连基础设施
 * 再装配应用，这里再兜一层：即便将来有人把 app 的导入顺序改回去，也不会静默退化成不限流。
 */
function createRedisStore(prefix: string): Store {
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: async (...args: string[]) => {
      if (!redis.isOpen) await connectRedis();
      return redis.sendCommand<RedisRawReply>(args);
    },
  });
}

// /health、/ready：当前 app.ts 将探针挂在全局限流之前，一般不会执行到此 skip；保留以便调整挂载顺序或复用本中间件时不误伤探针
function skipProbePaths(req: { path?: string }) {
  const p = req.path || "";
  return p === "/health" || p === "/ready";
}

/**
 * 把 express-rate-limit 自己的错误与告警接进统一日志。
 * 它默认直接 console 打印，在生产的 JSON 日志流里既不结构化、也带不上是哪一档限流。
 */
function limiterLogger(limiter: string): Logger {
  return {
    error: (error, message) => {
      logger.error("rate_limit_error", { limiter, message, error: serializeError(error) });
    },
    warn: (error, message) => {
      logger.warn("rate_limit_warning", { limiter, message, error: serializeError(error) });
    },
  };
}

/**
 * Redis 抖动时放行而不是 500。
 *
 * 限流是防滥用的安全带，不是业务功能：为了它把全站请求打成 500，是拿可用性换一个
 * 本来就只在异常期短暂失效的保护。放行会记 error 日志（见 limiterLogger），不会静默。
 */
const passOnStoreError = true;

export const globalRateLimitMiddleware = rateLimit({
  windowMs: RATE_LIMIT.globalWindowMs,
  limit: RATE_LIMIT.globalMax,
  store: createRedisStore("global"),
  passOnStoreError,
  skip: skipProbePaths,
  handler: (_req, res) => {
    return fail(res, 429, "请求过于频繁，请稍后再试");
  },
  logger: limiterLogger("global"),
});

export const authRateLimitMiddleware = rateLimit({
  windowMs: RATE_LIMIT.authWindowMs,
  limit: RATE_LIMIT.authMax,
  store: createRedisStore("auth"),
  passOnStoreError,
  handler: (_req, res) => {
    return fail(res, 429, "请求过于频繁，请稍后再试");
  },
  logger: limiterLogger("auth"),
});

/**
 * 刷新接口专用限流。
 *
 * 与登录共用一个桶是错的：登录是人触发的，而刷新是每个已登录标签页每 15 分钟一次的**自动**行为。
 * 办公室 / 校园网 NAT 后几十号人共用一个出口 IP 时，「1 分钟 10 次」正常使用就能打满，
 * 而刷新一旦被 429，前端的会话恢复就会失败——限流的效果变成了把自己人挡在门外。
 *
 * `skipSuccessfulRequests` 让成功的刷新不计数：正常用户永远碰不到阈值，
 * 只有反复失败（枚举刷新令牌）的来源才会被逐步收紧。
 */
export const refreshRateLimitMiddleware = rateLimit({
  windowMs: RATE_LIMIT.refreshWindowMs,
  limit: RATE_LIMIT.refreshMax,
  store: createRedisStore("refresh"),
  passOnStoreError,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    return fail(res, 429, "请求过于频繁，请稍后再试");
  },
  logger: limiterLogger("refresh"),
});
