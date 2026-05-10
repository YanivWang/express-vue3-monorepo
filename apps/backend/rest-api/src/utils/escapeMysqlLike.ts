/** 用于 MySQL LIKE 字面量匹配的通配符转义（默认转义字符为 \\） */
export function escapeMysqlLikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
