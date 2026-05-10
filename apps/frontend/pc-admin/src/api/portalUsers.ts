import { http } from "./http";

import type { CurrentUserProfile, Pagination } from "./types";

export function fetchPortalUsers(q: { page: number; limit: number; q?: string }) {
  return http.get<{ users: CurrentUserProfile[]; pagination: Pagination }>(
    "/api/admin/portal-users",
    q,
  );
}

export function patchPortalUser(id: number, body: { username?: string; avatar?: string | null }) {
  return http.patch<{ user: CurrentUserProfile }>(`/api/admin/portal-users/${id}`, body);
}

export function deletePortalUser(id: number) {
  return http.delete(`/api/admin/portal-users/${id}`);
}
