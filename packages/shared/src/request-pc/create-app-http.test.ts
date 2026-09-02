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

beforeEach(() => {
  vi.unstubAllGlobals();
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
