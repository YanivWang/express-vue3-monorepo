import { createTokenStorage, type TokenStorage } from "../utils/storage";

import { createPcHttp, type HttpRequest } from "./create-pc-http";

export interface CreateAppPcHttpOptions {
  tokenKey: string;
  baseURL: string;
  /** Vite `import.meta.env.BASE_URL` */
  baseUrl: string;
  tokenExpires?: number;
  /** 401 跳转登录前清理本地会话；建议 dynamic import store 以避免循环依赖 */
  onClearSession: () => void | Promise<void>;
}

export function createAppPcHttp(options: CreateAppPcHttpOptions): {
  http: HttpRequest;
  tokenStorage: TokenStorage;
} {
  const { tokenKey, baseURL, baseUrl, onClearSession, tokenExpires = 7 } = options;

  const tokenStorage = createTokenStorage({ tokenKey, tokenExpires });
  const base = baseUrl.replace(/\/$/, "");
  const loginPath = base ? `${base}/login` : "/login";

  const http = createPcHttp({
    baseURL,
    tokenStorage,
    loginPath,
    onLogout: onClearSession,
    enableLoading: true,
  });

  return { http, tokenStorage };
}
