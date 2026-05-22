import { getActivePinia } from "pinia";

import { createPcHttp, type TokenStorage } from "@express-vue3-monorepo/shared/request-pc";
import { createTokenStorage } from "@express-vue3-monorepo/shared/utils";

const tokenKey = "pc_admin_access_token";

export const tokenStorage: TokenStorage = createTokenStorage({
  tokenKey,
  tokenExpires: 7,
});

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const loginPath = base ? `${base}/login` : "/login";

export const http = createPcHttp({
  baseURL: String(import.meta.env.VITE_API_BASE_URL ?? ""),
  tokenStorage,
  loginPath,
  onLogout: async () => {
    const { useAuthStore } = await import("@/stores/auth");
    const pinia = getActivePinia();
    if (pinia) useAuthStore(pinia).clearSession();
  },
  enableLoading: true,
});
