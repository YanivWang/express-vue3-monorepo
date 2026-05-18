/** localStorage 键前缀：按文件名 + 大小 + lastModified 绑定未完成的 uploadId，供刷新后续传 */

const PREFIX = "ev3-lu:";

type StoredShape = { uploadId: string };

function storageKey(file: File): string {
  return `${PREFIX}${encodeURIComponent(file.name)}\u001f${file.size}\u001f${file.lastModified}`;
}

export function readPendingUploadId(file: File): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(file));
    if (!raw) return null;
    const o = JSON.parse(raw) as StoredShape;
    return typeof o.uploadId === "string" && o.uploadId.length > 0 ? o.uploadId : null;
  } catch {
    return null;
  }
}

export function writePendingUploadId(file: File, uploadId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(file), JSON.stringify({ uploadId }));
  } catch {
    /* 隐私模式 / 配额满 */
  }
}

export function clearPendingUploadId(file: File): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(storageKey(file));
  } catch {
    /* ignore */
  }
}
