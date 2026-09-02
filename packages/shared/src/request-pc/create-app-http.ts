import { createTokenStorage, type TokenStorage } from "../utils/storage.js";

import { createPcHttp, type HttpRequest } from "./create-pc-http.js";

export interface CreateAppPcHttpOptions {
  baseURL: string;
  /** Vite `import.meta.env.BASE_URL` */
  baseUrl: string;
  /** 401 跳转登录前清理本地会话；建议 dynamic import store 以避免循环依赖 */
  onClearSession: () => void | Promise<void>;
}

/** `POST /api/auth/refresh` 的响应载荷（rest-api 扁平形态） */
interface RefreshResponse {
  code?: number;
  token?: string;
}

/**
 * 刷新请求的超时（毫秒）。
 *
 * 应用启动时会先等这一次刷新拿回访问令牌再挂载路由（见各 app 的 main.ts），
 * 因此它必须有超时：后端不可达或被中间设备黑洞掉时，fetch 默认会一直挂着，
 * 表现就是整个站点停在白屏——而正确的行为是「按未登录渲染」，
 * 至少首页、文章页这些公开内容仍然可用。
 *
 * 用 AbortController + setTimeout 而不是 AbortSignal.timeout：
 * 后者要 Chrome 103 / Safari 16，会把支持面收窄到比 main.ts 里那条注释更高的基线。
 */
const REFRESH_TIMEOUT_MS = 10000;

/** 同源下所有标签页共用这一把锁；名字带前缀，避免与页面里其他用途的锁重名 */
const REFRESH_LOCK_NAME = "evm:auth:refresh";

/**
 * 把刷新串行化到「同源内同一时刻只有一个」。
 *
 * 访问令牌是每个标签页各存一份（内存），但刷新令牌是同源共享的**同一枚** Cookie。
 * 两个标签页同时刷新（浏览器恢复会话一次性打开多个标签、或门户与管理端同时开着），
 * 就会拿着同一枚令牌各自发起轮换：服务端只能靠宽限窗口把这种竞态兜住，
 * 而宽限窗口本质上是一段「重放检测的盲区」。
 *
 * 更好的做法是先别让竞态发生。Web Locks 让后到的标签页等前一个完成再发起，
 * 届时它读到的 Cookie 已经是轮换后的新令牌，于是变成一次正常的连续轮换，
 * 根本不构成重放——盲区因此只在锁不可用时才被用到。
 *
 * Web Locks 需要安全上下文（HTTPS / localhost）且 Safari 15.4+ 才有；
 * 拿不到就直接执行，退回服务端宽限窗口兜底，不因为一个优化项让刷新不可用。
 */
function withRefreshLock<T>(run: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks) return run();
  return locks.request(REFRESH_LOCK_NAME, run);
}

export function createAppPcHttp(options: CreateAppPcHttpOptions): {
  http: HttpRequest;
  tokenStorage: TokenStorage;
  /** 应用启动时调用：凭 HttpOnly Cookie 换回访问令牌，失败即视为未登录 */
  restoreSession: () => Promise<boolean>;
} {
  const { baseURL, baseUrl, onClearSession } = options;

  const tokenStorage = createTokenStorage();
  const base = baseUrl.replace(/\/$/, "");
  const loginPath = base ? `${base}/login` : "/login";

  /**
   * 刷新用原生 fetch 而不是被包装的 http 实例：
   * 后者带着令牌注入、401 拦截与刷新逻辑，用它来刷新会绕回自身形成递归。
   * `credentials: "include"` 保证跨域开发（Vite 5173 → API 3000）下也会带上刷新 Cookie。
   *
   * 外层套 withRefreshLock：同一时刻同源内只允许一次刷新在飞，理由见该函数的说明。
   */
  async function requestNewAccessToken(): Promise<string> {
    return withRefreshLock(fetchNewAccessToken);
  }

  async function fetchNewAccessToken(): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, REFRESH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${baseURL.replace(/\/$/, "")}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json;charset=UTF-8" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error("刷新登录状态失败");
    }
    const body = (await res.json()) as RefreshResponse;
    if (typeof body.token !== "string") {
      throw new Error("刷新响应缺少访问令牌");
    }
    return body.token;
  }

  const http = createPcHttp({
    baseURL,
    // 登录响应的 Set-Cookie 与登出请求的 Cookie 都依赖它，跨域开发下缺一不可
    withCredentials: true,
    tokenStorage,
    loginPath,
    onLogout: onClearSession,
    enableLoading: true,
    refreshAccessToken: requestNewAccessToken,
  });

  /**
   * 访问令牌只在内存中，刷新页面必然丢失；启动时用刷新 Cookie 静默换一枚回来。
   * 未登录用户这里会失败，属正常路径，因此只返回布尔值而不抛错。
   */
  async function restoreSession(): Promise<boolean> {
    try {
      tokenStorage.setToken(await requestNewAccessToken());
      return true;
    } catch {
      tokenStorage.removeToken();
      return false;
    }
  }

  return { http, tokenStorage, restoreSession };
}
