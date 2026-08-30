import type { TokenStorage } from "../utils/storage.js";
import type { Ref } from "vue";

export function isAuthError(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "type" in e && (e as { type?: string }).type === "auth"
  );
}

export interface SessionAuthDeps<TProfile> {
  tokenStorage: TokenStorage;
  token: Ref<string | null>;
  profile: Ref<TProfile | null>;
  fetchCurrentUser: (opts?: { silentUnauthorized?: boolean }) => Promise<{ user: TProfile }>;
  /**
   * 凭 HttpOnly 刷新令牌 Cookie 换回访问令牌；成功返回 true。
   * 访问令牌只存在于内存，刷新页面必然丢失，因此会话恢复必须走这一步——
   * 没有它，用户每次刷新页面都会被登出。
   */
  restoreSession: () => Promise<boolean>;
}

/** PC 端会话读写与 bootstrap 去重（各 app 在 Pinia store 内组合） */
export function createSessionAuthActions<TProfile>(deps: SessionAuthDeps<TProfile>) {
  const { tokenStorage, token, profile, fetchCurrentUser, restoreSession } = deps;
  let sessionBootstrapInFlight: Promise<void> | null = null;

  function setTokenFromLogin(next: string) {
    tokenStorage.setToken(next);
    token.value = next;
  }

  function clearSession() {
    tokenStorage.removeToken();
    token.value = null;
    profile.value = null;
  }

  async function fetchProfile(opts?: { silentUnauthorized?: boolean }) {
    if (!token.value) {
      profile.value = null;
      return;
    }
    try {
      const { user } = await fetchCurrentUser({
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

  async function bootstrapSession() {
    token.value = tokenStorage.getToken() ?? null;

    // 内存里没有访问令牌（首次进入或刚刷新页面）时，先尝试用刷新 Cookie 静默恢复
    if (!token.value) {
      const restored = await restoreSession();
      token.value = restored ? (tokenStorage.getToken() ?? null) : null;
    }

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

  return {
    setTokenFromLogin,
    clearSession,
    fetchProfile,
    bootstrapSession,
  };
}
