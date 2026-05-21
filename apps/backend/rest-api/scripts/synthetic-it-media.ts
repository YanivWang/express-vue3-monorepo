/**
 * 合成种子：经 REST `POST /api/uploads` 写入本站配图（与 pc-portal 富文本 `<img src="/uploads/posts/…">` 一致）。
 */

import { postUploadDiskSegment } from "../src/config/upload.config.js";

import { SYNTHETIC_IT_HTTP_UA } from "./synthetic-it-constants.js";

/** 1×1 PNG，用于无 Pexels Key 或拉图失败时的兜底上传 */
const MINIMAL_PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isPostUploadPublicUrl(src: string): boolean {
  const t = src.trim();
  return t.startsWith(`/uploads/${postUploadDiskSegment}/`);
}

export async function uploadImageBytesViaApi(opts: {
  apiBase: string;
  bearerToken: string;
  bytes: Uint8Array;
  filename: string;
  contentType: string;
  maxAttempts?: number;
}): Promise<string> {
  const url = `${opts.apiBase.replace(/\/$/, "")}/uploads`;
  let lastErr: unknown;

  for (let attempt = 0; attempt < (opts.maxAttempts ?? 3); attempt++) {
    try {
      const form = new FormData();
      form.append("files", new Blob([opts.bytes], { type: opts.contentType }), opts.filename);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.bearerToken}`,
          "User-Agent": SYNTHETIC_IT_HTTP_UA,
        },
        body: form,
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || j.code !== 200) {
        throw new Error(`POST ${url} failed: HTTP ${res.status} ${JSON.stringify(j)}`);
      }
      const urls = j.urls as string[] | undefined;
      const first = urls?.[0]?.trim();
      if (!first || !isPostUploadPublicUrl(first)) {
        throw new Error(`上传响应缺少合法 posts URL: ${JSON.stringify(j)}`);
      }
      return first;
    } catch (e) {
      lastErr = e;
      if (attempt < (opts.maxAttempts ?? 3) - 1) {
        await sleep(350 * (attempt + 1));
      }
    }
  }

  throw lastErr;
}

/** 上传内置 1×1 PNG，返回 `/uploads/posts/<年>/<月>/…` */
export async function uploadSeedPlaceholderImage(
  apiBase: string,
  bearerToken: string,
  label: string,
): Promise<string> {
  const safe = label.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 48) || "seed";
  return uploadImageBytesViaApi({
    apiBase,
    bearerToken,
    bytes: MINIMAL_PNG_BYTES,
    filename: `synthetic-seed-${safe}.png`,
    contentType: "image/png",
  });
}

export function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** 若正文中尚无 coverUrl，则在末尾追加 `<img>` */
export function embedCoverImageInHtml(html: string, coverUrl: string, title: string): string {
  const src = coverUrl.trim();
  if (!src) return html;
  if (html.includes(src)) return html;
  return `${html}\n<p><img src="${src}" alt="${escapeHtmlAttr(title)}" loading="lazy"/></p>`;
}
