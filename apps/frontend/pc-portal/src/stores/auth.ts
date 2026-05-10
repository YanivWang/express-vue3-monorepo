import { defineStore } from "pinia";
import { computed, ref } from "vue";

import * as authApi from "@/api/auth";
import { tokenStorage } from "@/api/http";
import { parseJwtPayload } from "@/utils/jwt";

import type { LoginParams, RegisterParams } from "@express-vue3-monorepo/shared/types";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(tokenStorage.getToken() ?? null);

  const claims = computed(() => (token.value ? parseJwtPayload(token.value) : null));

  const isLoggedIn = computed(() => !!token.value);

  function setTokenFromLogin(next: string) {
    tokenStorage.setToken(next);
    token.value = next;
  }

  function clearSession() {
    tokenStorage.removeToken();
    tokenStorage.removeRefreshToken();
    token.value = null;
  }

  async function login(payload: LoginParams) {
    const { token: next } = await authApi.login(payload);
    setTokenFromLogin(next);
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
    isLoggedIn,
    login,
    register,
    logout,
    clearSession,
    setTokenFromLogin,
  };
});
