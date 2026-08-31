/** 上传面板的纯展示格式化：不依赖组件状态，拆分后由多个子组件共用 */

/** 耗时：满一秒按秒读（两位小数），不足一秒按毫秒读（取整） */
export function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)} s`;
  }
  return `${Math.round(ms)} ms`;
}

/**
 * 可选耗时。未知时给占位符而不是空字符串——
 * 指标区在上传全程都在刷新，留空会让这一行的高度来回跳。
 */
export function formatOptionalDuration(ms: number | null): string {
  return ms != null ? formatDuration(ms) : "—";
}
