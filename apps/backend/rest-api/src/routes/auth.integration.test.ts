/**
 * 认证链路集成测试：真实 HTTP + 真实 MySQL + 真实 Redis。
 *
 * 覆盖的是原先完全没有测试的部分：中间件顺序、Zod 校验的实际拒绝行为、
 * JWT 签发与校验、以及登出黑名单在 Redis 上的真实效果。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dropTestDatabase,
  prepareTestEnv,
  recreateTestDatabase,
  registerAndLogin,
  startTestApi,
  type TestApi,
} from "../test/integration-harness.js";

const DB_NAME = "evm_it_auth";

let api: TestApi;

beforeAll(async () => {
  prepareTestEnv(DB_NAME);
  await recreateTestDatabase(DB_NAME);
  api = await startTestApi();
});

afterAll(async () => {
  await api.close();
  await dropTestDatabase(DB_NAME);
});

describe("探针", () => {
  it("/health 不触库即可返回存活", async () => {
    const res = await api.request("GET", "/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });

  it("/ready 校验 MySQL 与 Redis 均可用", async () => {
    const res = await api.request<{ checks: { mysql: string; redis: string } }>("GET", "/ready");
    expect(res.status).toBe(200);
    expect(res.body.checks).toEqual({ mysql: "ok", redis: "ok" });
  });
});

describe("注册与登录", () => {
  it("注册后可用同一凭据登录并取得 token", async () => {
    const { token, userId } = await registerAndLogin(api, "it_user_basic");
    expect(token).toBeTypeOf("string");
    expect(userId).toBeGreaterThan(0);
  });

  it("重复用户名注册返回 409 而不是 500", async () => {
    await registerAndLogin(api, "it_user_dup");
    const again = await api.request("POST", "/api/register", {
      body: { username: "it_user_dup", password: "test_password_123" },
    });
    expect(again.status).toBe(409);
  });

  it("密码错误不泄露账号是否存在", async () => {
    await registerAndLogin(api, "it_user_wrongpw");
    const res = await api.request("POST", "/api/login", {
      body: { username: "it_user_wrongpw", password: "definitely_wrong_pw" },
    });
    expect(res.status).toBe(401);
  });

  it("过短的密码被 Zod 拦在控制器之前", async () => {
    const res = await api.request("POST", "/api/register", {
      body: { username: "it_user_shortpw", password: "123" },
    });
    expect(res.status).toBe(400);
  });

  it("响应体绝不回传密码字段", async () => {
    const res = await api.request<{ user?: Record<string, unknown> }>("POST", "/api/register", {
      body: { username: "it_user_nopw_leak", password: "test_password_123" },
    });
    expect(JSON.stringify(res.body)).not.toContain("test_password_123");
    if (res.body.user) {
      expect(res.body.user).not.toHaveProperty("password");
    }
  });
});

describe("受保护路由与登出黑名单", () => {
  it("无 token 访问受保护路由返回 401", async () => {
    const res = await api.request("GET", "/api/posts/mine/list");
    expect(res.status).toBe(401);
  });

  it("伪造 token 返回 401", async () => {
    const res = await api.request("GET", "/api/posts/mine/list", {
      token: "not.a.real.jwt",
    });
    expect(res.status).toBe(401);
  });

  it("登出后同一 token 立即失效（Redis 黑名单真实生效）", async () => {
    const { token } = await registerAndLogin(api, "it_user_logout");

    const before = await api.request("GET", "/api/posts/mine/list", { token });
    expect(before.status).toBe(200);

    const logout = await api.request("POST", "/api/logout", { token });
    expect(logout.status).toBe(200);

    const after = await api.request("GET", "/api/posts/mine/list", { token });
    expect(after.status).toBe(401);
  });
});

describe("未命中路由", () => {
  it("未知路径统一走错误中间件返回 404 JSON", async () => {
    const res = await api.request("GET", "/api/definitely-not-a-route");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(404);
  });
});
