/**
 * 刷新令牌链路集成测试。
 *
 * 这条链路的价值全在「异常路径」上：轮换是否真的让旧令牌失效、重放是否真的被识破、
 * Cookie 的安全属性是否真的下发。这些都不是纯函数单测能覆盖的，
 * 必须让真实的 Express + Redis 参与，并检查真实的 Set-Cookie 响应头。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dropTestDatabase,
  prepareTestEnv,
  recreateTestDatabase,
  startTestApi,
  type TestApi,
} from "../test/integration-harness.js";

const DB_NAME = "evm_it_refresh";
const REFRESH_COOKIE = "evm_refresh_token";
/** 与 shared/constants/auth.ts 的 SESSION_HINT_COOKIE_NAME 对齐 */
const SESSION_HINT_COOKIE = "evm_has_session";
/**
 * 轮换宽限窗口压到 1 秒：既能测「窗口内的并发刷新不该踢人」，
 * 又不必为了测「窗口外的重放要撤销家族」而让用例干等半分钟。
 */
const GRACE_SECONDS = 1;

let api: TestApi;

/** 从 Set-Cookie 响应头里取出刷新令牌的值 */
function refreshTokenFromSetCookie(setCookie: string[] | undefined): string | undefined {
  const entry = setCookie?.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  if (!entry) return undefined;
  const value = entry.slice(REFRESH_COOKIE.length + 1).split(";")[0];
  return value === "" ? undefined : decodeURIComponent(value);
}

/** 直接用 fetch 而非基座的 request，因为这里必须读到原始响应头 */
async function rawPost(
  path: string,
  options: { body?: unknown; cookie?: string; token?: string } = {},
) {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.cookie) headers.Cookie = `${REFRESH_COOKIE}=${encodeURIComponent(options.cookie)}`;
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${api.baseUrl}${path}`, {
    method: "POST",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  return {
    status: res.status,
    body: (text ? JSON.parse(text) : {}) as { token?: string; expiresIn?: number; msg?: string },
    setCookie: res.headers.getSetCookie(),
  };
}

async function loginFresh(username: string) {
  await rawPost("/api/register", { body: { username, password: "test_password_123" } });
  const res = await rawPost("/api/login", { body: { username, password: "test_password_123" } });
  const refreshToken = refreshTokenFromSetCookie(res.setCookie);
  if (res.status !== 200 || !res.body.token || !refreshToken) {
    throw new Error(`登录失败(${String(res.status)}): ${res.body.msg ?? ""}`);
  }
  return { accessToken: res.body.token, refreshToken, setCookie: res.setCookie };
}

beforeAll(async () => {
  prepareTestEnv(DB_NAME);
  // 必须早于 startTestApi 内部的动态 import：src/env.ts 在模块加载时就固化了配置
  process.env.REFRESH_ROTATION_GRACE_SECONDS = String(GRACE_SECONDS);
  await recreateTestDatabase(DB_NAME);
  api = await startTestApi();
});

afterAll(async () => {
  await api.close();
  await dropTestDatabase(DB_NAME);
});

describe("登录下发的凭证", () => {
  it("访问令牌是短时效的，不再是改造前的 7 天", async () => {
    const res = await rawPost("/api/register", {
      body: { username: "it_rt_ttl", password: "test_password_123" },
    });
    expect(res.status).toBe(200);

    const login = await rawPost("/api/login", {
      body: { username: "it_rt_ttl", password: "test_password_123" },
    });
    expect(login.body.expiresIn).toBeLessThanOrEqual(60 * 60);
  });

  it("刷新令牌 Cookie 带齐 HttpOnly / SameSite=Strict，且不出现在响应体里", async () => {
    const { setCookie } = await loginFresh("it_rt_cookie_attrs");
    const entry = setCookie.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
    expect(entry).toBeDefined();
    expect(entry).toMatch(/HttpOnly/i);
    expect(entry).toMatch(/SameSite=Strict/i);
    expect(entry).toMatch(/Path=\/api/i);
  });

  it("响应体只给出访问令牌，刷新令牌不经 JS 可达的通道下发", async () => {
    const login = await rawPost("/api/login", {
      body: { username: "it_rt_cookie_attrs", password: "test_password_123" },
    });
    expect(login.body.token).toBeTypeOf("string");
    expect(JSON.stringify(login.body)).not.toContain("evm_refresh_token");
  });

  /**
   * 会话标记 Cookie（用途见 shared/constants/auth.ts）。
   *
   * 它必须与刷新 Cookie 同生共死：多活一刻，前端就会对着一个已经没了的会话反复发刷新；
   * 少活一刻，用户刷新页面就恢复不了登录态。所以「成对下发、成对清除」要有用例钉住。
   * 同时它必须**不是** HttpOnly——那是它存在的全部意义，前端读不到就等于没有。
   */
  it("会话标记与刷新 Cookie 成对下发，且刻意不是 HttpOnly", async () => {
    const { setCookie } = await loginFresh("it_rt_hint_cookie");
    const hint = setCookie.find((c) => c.startsWith(`${SESSION_HINT_COOKIE}=`));

    expect(hint).toBeDefined();
    expect(hint).not.toMatch(/HttpOnly/i);
    // Path 必须是 /，否则前端在 `/` 上用 document.cookie 根本读不到
    expect(hint).toMatch(/Path=\/(;|$)/i);
    expect(hint).toMatch(/SameSite=Strict/i);
  });

  it("刷新成功时标记随刷新 Cookie 一起续期", async () => {
    const { refreshToken } = await loginFresh("it_rt_hint_rotate");
    const refreshed = await rawPost("/api/auth/refresh", { cookie: refreshToken });

    expect(refreshed.status).toBe(200);
    expect(refreshed.setCookie.some((c) => c.startsWith(`${SESSION_HINT_COOKIE}=1`))).toBe(true);
  });

  it("刷新凭证无效时标记被一并清除，避免前端对着空会话空转", async () => {
    const res = await rawPost("/api/auth/refresh", { cookie: "not-a-real.token" });

    expect(res.status).toBe(401);
    const hint = res.setCookie.find((c) => c.startsWith(`${SESSION_HINT_COOKIE}=`));
    expect(hint).toBeDefined();
    // clearCookie 的表现是「置空值 + 立即过期」
    expect(hint).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it("登出时标记被一并清除", async () => {
    const { accessToken, refreshToken } = await loginFresh("it_rt_hint_logout");
    const res = await rawPost("/api/logout", { cookie: refreshToken, token: accessToken });

    expect(res.status).toBe(200);
    const hint = res.setCookie.find((c) => c.startsWith(`${SESSION_HINT_COOKIE}=`));
    expect(hint).toBeDefined();
    expect(hint).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });
});

describe("轮换", () => {
  it("刷新能换到新的访问令牌，且新令牌可用", async () => {
    const { refreshToken } = await loginFresh("it_rt_rotate");

    const refreshed = await rawPost("/api/auth/refresh", { cookie: refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.token).toBeTypeOf("string");

    const me = await api.request("GET", "/api/posts/mine/list", { token: refreshed.body.token });
    expect(me.status).toBe(200);
  });

  it("每次刷新都会换发新的刷新令牌", async () => {
    const { refreshToken } = await loginFresh("it_rt_rotate_new");
    const refreshed = await rawPost("/api/auth/refresh", { cookie: refreshToken });
    const nextToken = refreshTokenFromSetCookie(refreshed.setCookie);

    expect(nextToken).toBeDefined();
    expect(nextToken).not.toBe(refreshToken);
  });

  it("缺少刷新凭证时返回 401", async () => {
    const res = await rawPost("/api/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("伪造的刷新凭证返回 401", async () => {
    const res = await rawPost("/api/auth/refresh", { cookie: "fake-id.fake-secret" });
    expect(res.status).toBe(401);
  });
});

describe("并发刷新", () => {
  /**
   * 多标签页（乃至同源部署的门户与管理端）共用同一枚刷新 Cookie，
   * 会话恢复时可能在同一瞬间拿着同一枚令牌来刷新。
   * 若把这种竞态当成重放，用户什么都没做错就被强制登出——这是轮换式刷新最常见的线上事故。
   */
  it("同一枚令牌被并发提交时，双方都拿到可用令牌，会话不被踢掉", async () => {
    const { refreshToken } = await loginFresh("it_rt_concurrent");

    const [a, b] = await Promise.all([
      rawPost("/api/auth/refresh", { cookie: refreshToken }),
      rawPost("/api/auth/refresh", { cookie: refreshToken }),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    // 两个标签页各自拿到的新令牌都要能继续用
    for (const res of [a, b]) {
      const next = refreshTokenFromSetCookie(res.setCookie);
      expect(next).toBeDefined();
      const again = await rawPost("/api/auth/refresh", { cookie: next });
      expect(again.status).toBe(200);
    }
  });

  /**
   * 并发轮换必须有唯一赢家。
   *
   * 早期实现的轮换由若干条互不互斥的 Redis 命令组成，两个并发请求会双双签发，
   * 同一枚令牌当场分叉成两条各自有效的令牌链——「一个家族同一时刻只有一枚活令牌」
   * 就此失守，重放检测也再不会触发。这条只有真实 Redis 参与才算数：
   * 单测里的假替身证明不了 `SET NX` 的原子性。
   */
  it("并发提交拿到的是同一枚继任令牌，而不是各自一枚（不分叉）", async () => {
    const { refreshToken } = await loginFresh("it_rt_single_winner");

    const results = await Promise.all(
      Array.from({ length: 4 }, () => rawPost("/api/auth/refresh", { cookie: refreshToken })),
    );

    const tokens = results.map((r) => {
      expect(r.status).toBe(200);
      return refreshTokenFromSetCookie(r.setCookie);
    });

    expect(new Set(tokens).size).toBe(1);
    expect(tokens[0]).toBeDefined();
  });

  /**
   * 宽限窗口是幂等重放，不是铸币机。
   *
   * 早期实现每次重放都补发一枚新的：窗口内重放 N 次即得 N 条同时有效、彼此独立的链。
   * 于是攻击者拿到被盗令牌后只要在窗口内刷一次，就能开出一条与受害者并行、
   * 且此后再也不会触发重放检测的会话——因为他不必再碰那枚旧令牌了。
   */
  it("宽限窗口内反复重放同一枚令牌，每次都拿回同一枚", async () => {
    const { refreshToken } = await loginFresh("it_rt_idempotent_grace");

    const first = await rawPost("/api/auth/refresh", { cookie: refreshToken });
    expect(first.status).toBe(200);
    const successor = refreshTokenFromSetCookie(first.setCookie);
    expect(successor).toBeDefined();

    for (let i = 0; i < 3; i++) {
      const replay = await rawPost("/api/auth/refresh", { cookie: refreshToken });
      expect(replay.status).toBe(200);
      expect(refreshTokenFromSetCookie(replay.setCookie)).toBe(successor);
    }
  });
});

describe("重放检测", () => {
  it("旧刷新令牌在宽限窗口之外被再次使用时，整个令牌家族一并作废", async () => {
    const { refreshToken: first } = await loginFresh("it_rt_reuse");

    // 正常轮换一次，first 就此作废
    const rotated = await rawPost("/api/auth/refresh", { cookie: first });
    expect(rotated.status).toBe(200);
    const second = refreshTokenFromSetCookie(rotated.setCookie);
    expect(second).toBeDefined();

    // 等过并发宽限窗口：此时再出现的旧令牌只可能是被复制走的
    await new Promise((resolve) => setTimeout(resolve, (GRACE_SECONDS + 0.5) * 1000));

    // 攻击者拿着被复制走的旧令牌再来一次 —— 必须被识破
    const replayed = await rawPost("/api/auth/refresh", { cookie: first });
    expect(replayed.status).toBe(401);

    // 关键：识破之后，真实用户手里那枚「合法的」新令牌也必须失效，
    // 否则攻击者与用户会并行持有会话
    const afterRevoke = await rawPost("/api/auth/refresh", { cookie: second });
    expect(afterRevoke.status).toBe(401);
  });

  it("只知道 tokenId 而不知道 secret 时，无法把别人的会话踢下线", async () => {
    const { refreshToken } = await loginFresh("it_rt_forged_secret");
    const tokenId = refreshToken.split(".")[0];

    const forged = await rawPost("/api/auth/refresh", { cookie: `${tokenId}.not-the-secret` });
    expect(forged.status).toBe(401);

    // 真实令牌毫发无损：tokenId 会出现在日志里，不能成为撤销他人会话的钥匙
    const stillValid = await rawPost("/api/auth/refresh", { cookie: refreshToken });
    expect(stillValid.status).toBe(200);
  });
});

describe("登出", () => {
  it("登出会同时作废访问令牌与刷新令牌", async () => {
    const { accessToken, refreshToken } = await loginFresh("it_rt_logout");

    const out = await rawPost("/api/logout", { token: accessToken, cookie: refreshToken });
    expect(out.status).toBe(200);

    // 访问令牌进黑名单
    const withOldAccess = await api.request("GET", "/api/posts/mine/list", { token: accessToken });
    expect(withOldAccess.status).toBe(401);

    // 刷新令牌被真正撤销，不能再换新令牌（这是改造前做不到的：JWT 无法撤回）
    const withOldRefresh = await rawPost("/api/auth/refresh", { cookie: refreshToken });
    expect(withOldRefresh.status).toBe(401);
  });

  it("登出会清除刷新令牌 Cookie", async () => {
    const { accessToken, refreshToken } = await loginFresh("it_rt_logout_cookie");
    const out = await rawPost("/api/logout", { token: accessToken, cookie: refreshToken });
    const cleared = out.setCookie.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
    expect(cleared).toBeDefined();
    expect(refreshTokenFromSetCookie(out.setCookie)).toBeUndefined();
  });
});

/**
 * 登出的可用性。
 *
 * 早期登出挂着 authMiddleware，访问令牌一过期就返回 401、家族原封不动地活着——
 * 用户以为退了，服务端的会话还能再续满一个刷新周期。
 * 撤销真正依赖的是 Cookie 里那枚刷新令牌，不是 Bearer。
 */
describe("登出", () => {
  it("访问令牌无效时，凭 Cookie 仍能真正撤销会话", async () => {
    const { refreshToken } = await loginFresh("it_rt_logout_no_bearer");

    const res = await rawPost("/api/logout", { cookie: refreshToken, token: "not-a-valid-jwt" });
    expect(res.status).toBe(200);

    // 关键断言：不是「返回 200 但什么也没撤销」
    const after = await rawPost("/api/auth/refresh", { cookie: refreshToken });
    expect(after.status).toBe(401);
  });

  it("完全不带 Bearer 也能撤销", async () => {
    const { refreshToken } = await loginFresh("it_rt_logout_cookie_only");

    expect((await rawPost("/api/logout", { cookie: refreshToken })).status).toBe(200);
    expect((await rawPost("/api/auth/refresh", { cookie: refreshToken })).status).toBe(401);
  });

  it("什么都不带时是幂等的成功，而不是 401", async () => {
    // 登出的语义是「让我处于未登录状态」，这个状态已经达成了；
    // 回 401 只会让客户端以为没退成功而反复重试。
    expect((await rawPost("/api/logout")).status).toBe(200);
  });

  it("带上有效 Bearer 时，该访问令牌也立即失效（jti 拉黑）", async () => {
    const { accessToken, refreshToken } = await loginFresh("it_rt_logout_blacklist");

    expect(
      (await rawPost("/api/logout", { cookie: refreshToken, token: accessToken })).status,
    ).toBe(200);

    const me = await api.request("GET", "/api/posts/mine/list", { token: accessToken });
    expect(me.status).toBe(401);
  });
});

/**
 * API 文档端点。
 *
 * openapi.yaml 是这套服务最完整的一份攻击面清单，生产默认不该对外。
 * 集成测试跑在 APP_ENV=test 下（默认开启），所以这里验的是「开关确实接上了」。
 */
describe("API 文档开关", () => {
  it("开启时 /openapi.yaml 可服务", async () => {
    const res = await fetch(`${api.baseUrl}/openapi.yaml`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/yaml/);
  });
});
