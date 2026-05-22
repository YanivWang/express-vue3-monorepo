import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { login as apiLogin, logout as apiLogout, register as apiRegister } from "@/api/auth";
import { tokenStorage } from "@/api/http";
import type { CurrentUserProfile } from "@/api/types";
import * as userApi from "@/api/user";
import { parseJwtPayload } from "@/utils/jwt";

import type { LoginParams, RegisterParams } from "@express-vue3-monorepo/shared/types";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(tokenStorage.getToken() ?? null);

  const claims = computed(() => (token.value ? parseJwtPayload(token.value) : null));

  /** 以服务端 GET /api/me 为准；登录后与刷新页面时拉取 */
  const profile = ref<CurrentUserProfile | null>(null);

  const isLoggedIn = computed(() => !!token.value);

  const displayName = computed(
    () => profile.value?.nickname ?? profile.value?.username ?? claims.value?.username ?? "",
  );

  function setTokenFromLogin(next: string) {
    tokenStorage.setToken(next);
    token.value = next;
  }

  function clearSession() {
    tokenStorage.removeToken();
    token.value = null;
    profile.value = null;
  }

  async function fetchProfile() {
    if (!token.value) {
      profile.value = null;
      return;
    }
    try {
      const { user } = await userApi.fetchCurrentUser();
      profile.value = user;
    } catch {
      profile.value = null;
    }
  }

  async function login(payload: LoginParams) {
    const { token: next } = await apiLogin(payload);
    setTokenFromLogin(next);
    await fetchProfile();
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
        clearSession();
      }
    } else {
      clearSession();
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
    clearSession,
    setTokenFromLogin,
    fetchProfile,
  };
});
