import type { LocationQuery, LocationQueryRaw, LocationQueryValue } from "vue-router";

/** 首页的筛选状态全部落在 URL 上，这里是读写这份 query 的两个共用规则 */

/** query 里的数值参数：缺失、空串与非数字一律按「未指定」处理 */
export function readNumberQuery(
  raw: LocationQueryValue | LocationQueryValue[] | undefined,
): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * 在当前 query 上打补丁生成新的 query，值为 undefined 表示删掉该键。
 * 侧栏与排序页签都经由它生成链接，这样切分类不会把排序丢掉、切排序也不会把分类丢掉。
 */
export function mergedQuery(
  current: LocationQuery,
  patch: Record<string, string | undefined>,
): LocationQueryRaw {
  const next: LocationQueryRaw = { ...current };
  for (const [k, val] of Object.entries(patch)) {
    if (val === undefined) delete next[k];
    else next[k] = val;
  }
  return next;
}
