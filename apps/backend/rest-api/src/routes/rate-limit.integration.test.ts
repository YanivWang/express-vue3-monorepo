/**
 * 限流的「存储」与「分档」，必须用真实 Redis 才能证明。
 *
 * 这条链路上有两个曾经真实发生、且都不会自己喊疼的坑：
 * 1) 计数放在进程内存里——单副本时一切正常，横向扩容后阈值被副本数悄悄放大；
 * 2) 限流存储在中间件构造时就要向 Redis 加载 Lua 脚本，若那一刻客户端还没连上，
 *    rate-limit-redis 会缓存住这个失败的 promise，之后每次计数都拿到同一个拒绝结果，
 *    限流永久失效——而 passOnStoreError 会让它安静地放行，日志之外没有任何症状。
 * 所以这里既断言「超过阈值真的会 429」，也断言「计数真的落在 Redis 里」。
 *
 * 本用例不碰 MySQL：`POST /api/auth/refresh` 在没有 Cookie 时于任何库访问之前就返回 401，
 * 因此只需要一个真实 Redis 即可运行。
 */
import { createServer, type Server } from "node:http";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AddressInfo } from "node:net";

/** 刷新档阈值压到 3，用最少的请求次数覆盖「未超限 → 超限」的边界 */
const REFRESH_LIMIT = 3;
const KEY_PREFIX = "rl:";

let server: Server;
let baseUrl: string;
let redisClient: typeof import("../redis.js").redis;
let closeRedis: () => Promise<void>;

async function post(path: string, cookie?: string): Promise<number> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: cookie === undefined ? {} : { Cookie: cookie },
  });
  return res.status;
}

/**
 * 一枚格式合法但服务端认不出的刷新令牌：足以让请求「携带了凭证」，
 * 又不需要连库或事先登录（rotateRefreshToken 认不出它时在任何 DB 访问之前就返回 invalid）。
 *
 * Cookie 名写成字面量而不是从 `../env.js` 导入：env.ts 在模块加载时就固化配置，
 * 而本用例的环境变量要到 beforeAll 才设好，顶层导入它会让整套配置在错误的时刻定型。
 */
const BOGUS_REFRESH_COOKIE = "evm_refresh_token=00000000-0000-4000-8000-000000000000.deadbeef";

beforeAll(async () => {
  // env.ts 在模块加载时即固化配置，因此这些必须先于任何应用模块的 import
  process.env.APP_ENV = "test";
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "error";
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? "integration_test_secret_at_least_32_chars_long";
  // 本用例不连库，但 env.ts 要求这些键非空
  process.env.DB_HOST = process.env.DB_HOST ?? "127.0.0.1";
  process.env.DB_USER = process.env.DB_USER ?? "root";
  process.env.DB_PWD = process.env.DB_PWD ?? "unused_by_this_suite";
  process.env.DB_NAME = process.env.DB_NAME ?? "unused_by_this_suite";
  process.env.RATE_LIMIT_GLOBAL_MAX = "100000";
  process.env.RATE_LIMIT_REFRESH_MAX = String(REFRESH_LIMIT);
  process.env.RATE_LIMIT_REFRESH_WINDOW_MS = "60000";

  const { connectRedis, disconnectRedis, redis } = await import("../redis.js");
  await connectRedis();
  redisClient = redis;
  closeRedis = disconnectRedis;

  // 只清限流自己的 key，避免影响同一 Redis 上的其他用例
  const stale = await redis.keys(`${KEY_PREFIX}*`);
  if (stale.length > 0) await redis.del(stale);

  // app 必须最后导入：它的模块体里就会构造限流中间件并访问 Redis（见 server.ts 的说明）
  const { default: app } = await import("../app.js");
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await closeRedis();
});

describe("刷新接口限流", () => {
  /**
   * 「只统计失败」的反噬：**没带凭证的请求也是失败**。
   *
   * 前端启动时要凭刷新 Cookie 换回访问令牌，改造前这一步无条件发送，匿名访客也发、且必然 401。
   * 于是「一次匿名首屏 = 一次计数」，同一出口 IP（公司 NAT / CGNAT / CDN 回源）
   * 上够数的匿名首屏就能打满桶，把该 IP 上**真正登录**的用户挡在 429 外面。
   * 主要修法在前端（会话标记 Cookie），这里守的是服务端那一半：无凭证的尝试不占额度。
   */
  it("没带刷新 Cookie 的请求不占额度，再多也只会是 401", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < REFRESH_LIMIT * 3; i++) {
      statuses.push(await post("/api/auth/refresh"));
    }

    expect(statuses).toEqual(Array(REFRESH_LIMIT * 3).fill(401));
  });

  it("带着刷新 Cookie 的失败尝试照常计数，超过阈值返回 429", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < REFRESH_LIMIT + 2; i++) {
      statuses.push(await post("/api/auth/refresh", BOGUS_REFRESH_COOKIE));
    }

    // 认不出的令牌一律 401；到达阈值后被限流器接管，返回 429
    expect(statuses.slice(0, REFRESH_LIMIT)).toEqual(Array(REFRESH_LIMIT).fill(401));
    expect(statuses.slice(REFRESH_LIMIT)).toEqual([429, 429]);
  });

  it("计数落在 Redis 而不是进程内存，多副本才能共用同一个桶", async () => {
    const keys = await redisClient.keys(`${KEY_PREFIX}refresh:*`);
    expect(keys.length).toBeGreaterThan(0);
  });

  it("各档使用独立前缀，全局与刷新的计数不会互相串台", async () => {
    const globalKeys = await redisClient.keys(`${KEY_PREFIX}global:*`);
    const refreshKeys = await redisClient.keys(`${KEY_PREFIX}refresh:*`);
    expect(globalKeys.length).toBeGreaterThan(0);
    expect(globalKeys.some((k) => refreshKeys.includes(k))).toBe(false);
  });
});
