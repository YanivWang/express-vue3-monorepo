/** 任一权限命中 */
export function hasAnyPermission(
  grants: readonly string[] | undefined,
  codes: readonly string[],
): boolean {
  if (!grants?.length || !codes.length) return false;
  return codes.some((c) => grants.includes(c));
}

/** 同时具备 */
export function hasAllPermissions(grants: readonly string[] | undefined, codes: readonly string[]) {
  if (!grants?.length || !codes.length) return false;
  return codes.every((c) => grants.includes(c));
}

/** 是否具备任意后台管理能力（路由入口） */
export function hasStaffEntry(grants: readonly string[] | undefined) {
  return Boolean(grants?.some((x) => x.startsWith("admin.")));
}

export function isDangerousPermission(code: string) {
  return (
    code.includes(".delete") ||
    code.includes(".invite") ||
    code.endsWith(".reset_password") ||
    code.endsWith(".assign_role") ||
    code === "admin.roles.manage"
  );
}
