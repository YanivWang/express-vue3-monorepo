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
