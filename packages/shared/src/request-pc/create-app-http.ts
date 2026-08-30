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
   */
  async function requestNewAccessToken(): Promise<string> {
    const res = await fetch(`${baseURL.replace(/\/$/, "")}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
    });
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
