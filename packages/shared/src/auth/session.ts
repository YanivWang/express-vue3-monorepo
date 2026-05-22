import type { TokenStorage } from "../utils/storage";
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
}

/** PC 端会话读写与 bootstrap 去重（各 app 在 Pinia store 内组合） */
export function createSessionAuthActions<TProfile>(deps: SessionAuthDeps<TProfile>) {
  const { tokenStorage, token, profile, fetchCurrentUser } = deps;
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
