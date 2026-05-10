import { http } from "./http";

import type { CurrentUserResult } from "./types";

export function fetchCurrentUser() {
  return http.get<CurrentUserResult>("/api/me");
}
