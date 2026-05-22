import { defineStore } from "pinia";
import { computed, ref } from "vue";

import * as authApi from "@/api/auth";
import { tokenStorage } from "@/api/http";
import type { CurrentUserProfile } from "@/api/types";
import * as userApi from "@/api/user";

import { createSessionAuthActions } from "@express-vue3-monorepo/shared/auth";
import type { LoginParams } from "@express-vue3-monorepo/shared/types";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(tokenStorage.getToken() ?? null);
  const profile = ref<CurrentUserProfile | null>(null);
  const isLoggedIn = computed(() => !!token.value);
  const permissions = computed(() => profile.value?.permissions ?? []);
  const userId = computed(() => profile.value?.id ?? null);

  const session = createSessionAuthActions({
    tokenStorage,
    token,
    profile,
    fetchCurrentUser: userApi.fetchCurrentUser,
  });

  async function login(payload: LoginParams) {
    const { token: next } = await authApi.login(payload);
    session.setTokenFromLogin(next);
    await session.fetchProfile();
  }

  async function logout() {
    if (token.value) {
      try {
        await authApi.logout();
      } catch {
        /* 尽力通知服务端拉黑 JWT；失败仍清本地会话 */
      } finally {
        session.clearSession();
      }
    } else {
      session.clearSession();
    }
  }

  return {
    token,
    profile,
    permissions,
    userId,
    isLoggedIn,
    login,
    logout,
    clearSession: session.clearSession,
    fetchProfile: session.fetchProfile,
    bootstrapSession: session.bootstrapSession,
  };
});
