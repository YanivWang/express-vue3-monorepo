import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { login as apiLogin, logout as apiLogout, register as apiRegister } from "@/api/auth";
import { tokenStorage } from "@/api/http";
import type { CurrentUserProfile } from "@/api/types";
import * as userApi from "@/api/user";
import { parseJwtPayload } from "@/utils/jwt";

import { createSessionAuthActions } from "@express-vue3-monorepo/shared/auth";
import type { LoginParams, RegisterParams } from "@express-vue3-monorepo/shared/types";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(tokenStorage.getToken() ?? null);
  const claims = computed(() => (token.value ? parseJwtPayload(token.value) : null));
  const profile = ref<CurrentUserProfile | null>(null);
  const isLoggedIn = computed(() => !!token.value);

  const displayName = computed(
    () => profile.value?.nickname ?? profile.value?.username ?? claims.value?.username ?? "",
  );

  const session = createSessionAuthActions({
    tokenStorage,
    token,
    profile,
    fetchCurrentUser: userApi.fetchCurrentUser,
  });

  async function login(payload: LoginParams) {
    const { token: next } = await apiLogin(payload);
    session.setTokenFromLogin(next);
    await session.fetchProfile();
  }

  async function register(payload: RegisterParams) {
    await apiRegister(payload);
  }

  async function logout() {
    if (token.value) {
      try {
        await apiLogout();
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
    claims,
    profile,
    displayName,
    isLoggedIn,
    login,
    register,
    logout,
    clearSession: session.clearSession,
    setTokenFromLogin: session.setTokenFromLogin,
    fetchProfile: session.fetchProfile,
    bootstrapSession: session.bootstrapSession,
  };
});
