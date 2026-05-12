import { http } from "./http";

import type { CurrentUserProfile, Pagination } from "./types";

export interface RoleBrief {
  id: number;
  slug: string;
  name: string;
  isStaff: boolean;
  isSystem?: boolean;
}

export interface StaffRow extends CurrentUserProfile {
  role?: RoleBrief;
}

export function fetchStaffList(q: { page: number; limit: number; q?: string }) {
  return http.get<{ users: StaffRow[]; pagination: Pagination }>("/api/admin/staff", q);
}

export function createStaff(body: { username: string; password: string; roleId: number }) {
  return http.post<{ user: StaffRow }>("/api/admin/staff", body);
}

export function patchStaff(
  id: number,
  body: Partial<{ username: string; avatar: string | null; password?: string; roleId: number }>,
) {
  return http.patch<{ user: StaffRow }>(`/api/admin/staff/${id}`, body);
}

export function revokeStaff(id: number) {
  return http.delete(`/api/admin/staff/${id}`);
}

export function fetchStaffRoleOptions() {
  return http.get<{ roles: { id: number; slug: string; name: string; isSystem: boolean }[] }>(
    "/api/admin/staff-role-options",
  );
}
