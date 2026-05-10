import { http } from "./http";

import type { CurrentUserProfile } from "./types";

export function fetchCurrentUser(opts?: { silentUnauthorized?: boolean }) {
  return http.get<{ user: CurrentUserProfile }>("/api/me", {
    skipUnauthorizedDialog: opts?.silentUnauthorized === true,
  });
}
