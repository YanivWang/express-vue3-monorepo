import type { LoginParams, LoginResult } from "@express-vue3-monorepo/shared/types";

import { http } from "./http";

export function login(body: LoginParams) {
  return http.post<LoginResult>("/api/login", body, { withToken: false });
}

export function logout() {
  return http.post<Record<string, never> | undefined>(
    "/api/logout",
    {},
    {
      skipUnauthorizedDialog: true,
      showError: false,
    },
  );
}
