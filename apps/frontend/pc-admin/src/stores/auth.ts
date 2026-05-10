import { defineStore } from "pinia";
import { computed, ref } from "vue";

import * as authApi from "@/api/auth";
import { tokenStorage } from "@/api/http";
import type { CurrentUserProfile } from "@/api/types";
import * as userApi from "@/api/user";


/** 并发导航共享同一次「恢复会话」请求，避免重复 /me */
let sessionBootstrapInFlight: Promise<void> | null = null;

function isAuthError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "type" in e &&
    (e as { type?: string }).type === "auth"
  );
}

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(tokenStorage.getToken() ?? null);
  const profile = ref<CurrentUserProfile | null>(null);
  const isLoggedIn = computed(() => !!token.value);
  const permissions = computed(() => profile.value?.permissions ?? []);
  const userId = computed(() => profile.value?.id ?? null);

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

  /** 拉取当前用户；仅 silentUnauthorized 时 401 不弹全局框，由本处清会话 */
  async function fetchProfile(opts?: { silentUnauthorized?: boolean }) {
    if (!token.value) {
      profile.value = null;
      return;
    }
    try {
      const { user } = await userApi.fetchCurrentUser({
        silentUnauthorized: opts?.silentUnauthorized === true,
      });
      profile.value = user;
    } catch (e) {
      profile.value = null;
      if (opts?.silentUnauthorized && isAuthError(e)) {
        clearSession();
      }
    }
  }

  /**
   * 启动/刷新页时恢复会话：与存储同步 token，必要时单次去重请求 /me。
   */
  async function bootstrapSession() {
    token.value = tokenStorage.getToken() ?? null;
    if (!token.value) {
      profile.value = null;
      return;
    }
    if (profile.value) {
      return;
    }
    if (!sessionBootstrapInFlight) {
      sessionBootstrapInFlight = fetchProfile({ silentUnauthorized: true }).finally(() => {
        sessionBootstrapInFlight = null;
      });
    }
    await sessionBootstrapInFlight;
  }

  async function login(payload: { username: string; password: string }) {
    const { token: next } = await authApi.login(payload);
    setTokenFromLogin(next);
    await fetchProfile();
  }

  function logout() {
    clearSession();
  }

  return {
    token,
    profile,
    permissions,
    userId,
    isLoggedIn,
    login,
    logout,
    clearSession,
    fetchProfile,
    bootstrapSession,
  };
});
