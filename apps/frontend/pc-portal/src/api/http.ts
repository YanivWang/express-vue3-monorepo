import { getActivePinia } from "pinia";

import { createAppPcHttp } from "@express-vue3-monorepo/shared/request-pc";

const tokenKey = "pc_portal_access_token";

export const { http, tokenStorage } = createAppPcHttp({
  tokenKey,
  baseURL: String(import.meta.env.VITE_API_BASE_URL ?? ""),
  baseUrl: import.meta.env.BASE_URL,
  onClearSession: async () => {
    const { useAuthStore } = await import("@/stores/auth");
    const pinia = getActivePinia();
    if (pinia) useAuthStore(pinia).clearSession();
  },
});
