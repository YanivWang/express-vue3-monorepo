import { defineStore } from "pinia";
import { computed, ref } from "vue";

import * as authApi from "@/api/auth";
import { tokenStorage } from "@/api/http";
import type { CurrentUserProfile } from "@/api/types";
import * as userApi from "@/api/user";
import { parseJwtPayload } from "@/utils/jwt";

import type { LoginParams, RegisterParams } from "@vue3-express-monorepo/shared/types";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(tokenStorage.getToken() ?? null);

  const claims = computed(() => (token.value ? parseJwtPayload(token.value) : null));

  /** 以服务端 GET /api/me 为准；登录后与刷新页面时拉取 */
  const profile = ref<CurrentUserProfile | null>(null);

  const isLoggedIn = computed(() => !!token.value);

  const displayName = computed(() => profile.value?.username ?? claims.value?.username ?? "");

  function setTokenFromLogin(next: string) {
    tokenStorage.setToken(next);
    token.value = next;
  }

  function clearSession() {
    tokenStorage.removeToken();
    tokenStorage.removeRefreshToken();
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
    const { token: next } = await authApi.login(payload);
    setTokenFromLogin(next);
    await fetchProfile();
  }

  async function register(payload: RegisterParams) {
    await authApi.register(payload);
  }

  function logout() {
    clearSession();
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
