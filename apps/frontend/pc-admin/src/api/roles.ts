import { http } from "./http";

export interface PermissionDef {
  id: number;
  code: string;
  description: string | null;
}

export interface RoleAgg {
  id: number;
  name: string;
  slug: string;
  isSystem: boolean;
  isStaff: boolean;
  permissions: PermissionDef[];
  userCount: number;
}

export function fetchPermissionDefs() {
  return http.get<{ permissions: PermissionDef[] }>("/api/admin/permissions");
}

export function fetchRoles() {
  return http.get<{ roles: RoleAgg[] }>("/api/admin/roles");
}

export function createRole(body: { name: string; slug: string; isStaff?: boolean }) {
  return http.post<{ role: RoleAgg }>("/api/admin/roles", body);
}

export function patchRole(
  id: number,
  body: Partial<{ name: string; isStaff: boolean; permissionCodes: string[] }>,
) {
  return http.patch<{ role: RoleAgg }>(`/api/admin/roles/${id}`, body);
}

export function deleteRole(id: number) {
  return http.delete(`/api/admin/roles/${id}`);
}
