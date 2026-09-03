/**
 * 会话恢复（`POST /api/auth/refresh`）的行为基线。
 *
 * 这段代码是两个前端 app 登录态的根：访问令牌只在内存，刷新页面必然丢失，
 * 全靠它凭 HttpOnly Cookie 换回来。它出问题的表现是「偶发掉登录」「刷新后白屏」，
 * 都属于事后极难复现的症状，因此把三条约束固定成用例：
 * 携带 Cookie、跨标签页串行、不会无限期挂起。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./create-pc-http.js", () => ({
  // 本用例只关心刷新链路，HTTP 实例本身由 request-core 的用例覆盖
  createPcHttp: vi.fn(() => ({})),
}));

import { SESSION_HINT_COOKIE_NAME } from "../constants/auth.js";

import { createAppPcHttp } from "./create-app-http.js";

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 真正会串行执行的 Web Locks 替身：足以观察「后到的刷新有没有等前一个」 */
function installSerializingLocks(): { held: () => number } {
  let chain: Promise<unknown> = Promise.resolve();
  let concurrent = 0;
  let maxConcurrent = 0;

  const locks = {
    request: (_name: string, callback: () => Promise<unknown>) => {
      const run = chain.then(async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        try {
          return await callback();
        } finally {
          concurrent -= 1;
        }
      });
      chain = run.catch(() => undefined);
      return run;
    },
  };

  vi.stubGlobal("navigator", { locks });
  return { held: () => maxConcurrent };
}

function createHttp(onClearSession = vi.fn()) {
  return createAppPcHttp({
    baseURL: "http://api.test",
    baseUrl: "/",
    onClearSession,
  });
}

/**
 * 会话标记 Cookie 的替身。
 *
 * node 环境没有 document，而 restoreSession 现在会先看标记再决定发不发请求，
 * 所以除「专门验证门禁」的用例外，其余用例都要先把标记装上——
 * 它们验的是刷新链路本身（串行、超时、带 Cookie），前提就是「本机有会话」。
 */
function installSessionHint(cookie = `${SESSION_HINT_COOKIE_NAME}=1`) {
  vi.stubGlobal("document", { cookie });
}

beforeEach(() => {
  vi.unstubAllGlobals();
  installSessionHint();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
});

describe("restoreSession", () => {
  it("成功时把访问令牌放进内存存储", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(jsonResponse({ code: 200, token: "t-1" })));

    const { restoreSession, tokenStorage } = createHttp();

    await expect(restoreSession()).resolves.toBe(true);
    expect(tokenStorage.getToken()).toBe("t-1");
  });

  it("未登录（401）时按未登录处理，而不是抛错中断应用启动", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(jsonResponse({ code: 401 }, 401)));

    const { restoreSession, tokenStorage } = createHttp();

    await expect(restoreSession()).resolves.toBe(false);
    expect(tokenStorage.getToken()).toBeUndefined();
  });

  it("带上 Cookie 发送——跨域开发下没有它就永远换不回令牌", async () => {
    let requestedUrl: unknown;
    let requestInit: RequestInit | undefined;
    globalThis.fetch = (url: unknown, init?: RequestInit) => {
      requestedUrl = url;
      requestInit = init;
      return Promise.resolve(jsonResponse({ code: 200, token: "t-2" }));
    };

    await createHttp().restoreSession();

    expect(requestedUrl).toBe("http://api.test/api/auth/refresh");
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.credentials).toBe("include");
  });

  it("后端挂起时按超时收场，不把应用一直卡在白屏", async () => {
    vi.useFakeTimers();
    // 永不 resolve 的请求，只在收到 abort 信号时拒绝
    globalThis.fetch = (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });

    const pending = createHttp().restoreSession();
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toBe(false);
  });
});

describe("跨标签页串行", () => {
  it("同源内同一时刻只允许一次刷新在飞（Web Locks 可用时）", async () => {
    const locks = installSerializingLocks();
    let inFlight = 0;
    let maxInFlight = 0;
    globalThis.fetch = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return jsonResponse({ code: 200, token: "t-3" });
    });

    const { restoreSession } = createHttp();
    await Promise.all([restoreSession(), restoreSession(), restoreSession()]);

    // 若没有串行，三次刷新会拿着同一枚 Cookie 并发轮换，服务端只能靠宽限窗口兜
    expect(maxInFlight).toBe(1);
    expect(locks.held()).toBe(1);
  });

  it("Web Locks 不可用时降级为直接执行，不因缺少优化项而失效", async () => {
    vi.stubGlobal("navigator", {});
    globalThis.fetch = vi.fn(() => Promise.resolve(jsonResponse({ code: 200, token: "t-4" })));

    const { restoreSession, tokenStorage } = createHttp();

    await expect(restoreSession()).resolves.toBe(true);
    expect(tokenStorage.getToken()).toBe("t-4");
  });
});

/**
 * 会话标记门禁。
 *
 * 改造前 restoreSession 是无条件发请求的，匿名访客也发、且必然 401。
 * 而刷新那一档限流只统计失败，于是匿名首屏会一格一格吃掉额度，
 * 最终把同一出口 IP 上真正登录的用户挡在 429 外面——这正是限流本想避免的事故。
 * 因此「没有标记就不发请求」必须是一条有用例守着的硬约束，而不是一次性的优化。
 */
describe("会话标记门禁", () => {
  it("没有标记时压根不发刷新请求，直接按未登录返回", async () => {
    vi.stubGlobal("document", { cookie: "" });
    const fetchSpy = vi.fn(() => Promise.resolve(jsonResponse({ code: 200, token: "t-5" })));
    globalThis.fetch = fetchSpy;

    const { restoreSession, tokenStorage } = createHttp();

    await expect(restoreSession()).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(tokenStorage.getToken()).toBeUndefined();
  });

  it("有标记时照常发起刷新", async () => {
    installSessionHint();
    const fetchSpy = vi.fn(() => Promise.resolve(jsonResponse({ code: 200, token: "t-6" })));
    globalThis.fetch = fetchSpy;

    await expect(createHttp().restoreSession()).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("只按名字匹配，不会被同前缀的其他 Cookie 误判", async () => {
    vi.stubGlobal("document", { cookie: `${SESSION_HINT_COOKIE_NAME}_other=1; unrelated=2` });
    const fetchSpy = vi.fn(() => Promise.resolve(jsonResponse({ code: 200, token: "t-7" })));
    globalThis.fetch = fetchSpy;

    await expect(createHttp().restoreSession()).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("标记在但服务端已失效时，走一次真实刷新并按失败收场", async () => {
    installSessionHint();
    globalThis.fetch = vi.fn(() => Promise.resolve(jsonResponse({ code: 401 }, 401)));

    const { restoreSession, tokenStorage } = createHttp();

    await expect(restoreSession()).resolves.toBe(false);
    expect(tokenStorage.getToken()).toBeUndefined();
  });
});
