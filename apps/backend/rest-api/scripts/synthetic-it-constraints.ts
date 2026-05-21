/** 合成 IT 种子脚本内校验；入库规则以 rest-api `content-safety.ts` 为准。 */

import {
  UPLOAD_MEDIA_SRC_RE,
  sanitizeHtmlContentForStorage,
  sanitizeTitleForStorage,
} from "../src/utils/content-safety.js";

export { UPLOAD_MEDIA_SRC_RE };

/** 每个叶子分类（合成脚本中的一类 bundle）帖子数量区间 */
export const SYNTHETIC_POSTS_PER_CATEGORY_MIN = 16;
export const SYNTHETIC_POSTS_PER_CATEGORY_MAX = 60;

/** LLM 生成帖的顶层 comments 条数（静态 bundle 不经此校验） */
export const SYNTHETIC_COMMENTS_TOPLEVEL_MIN = 4;
export const SYNTHETIC_COMMENTS_TOPLEVEL_MAX = 16;

/** 单条顶层评论下 replies 数组上限（与提示词一致） */
export const SYNTHETIC_COMMENT_REPLIES_MAX_PER_THREAD = 8;

export const SYNTHETIC_TITLE_MIN_LEN = 10;
export const SYNTHETIC_TITLE_MAX_LEN = 20;
export const SYNTHETIC_HTML_MIN_LEN = 300;
export const SYNTHETIC_HTML_MAX_LEN = 10000;

export function assertSyntheticPostLengths(title: string, html: string): void {
  const t = title.trim();
  const h = html.trim();
  if (t.length < SYNTHETIC_TITLE_MIN_LEN || t.length > SYNTHETIC_TITLE_MAX_LEN) {
    throw new Error(
      `title 长度须在 ${SYNTHETIC_TITLE_MIN_LEN}～${SYNTHETIC_TITLE_MAX_LEN} 字符（当前 ${t.length}）`,
    );
  }
  if (h.length < SYNTHETIC_HTML_MIN_LEN || h.length > SYNTHETIC_HTML_MAX_LEN) {
    throw new Error(
      `正文 html 长度须在 ${SYNTHETIC_HTML_MIN_LEN}～${SYNTHETIC_HTML_MAX_LEN} 字符（当前 ${h.length}）`,
    );
  }
}

export function assertSyntheticPostHtmlHasUploadImage(html: string): void {
  const m = html.match(/<img[^>]+src=["'](\/uploads\/[^"']+)["']/i);
  if (!m?.[1]) {
    throw new Error('正文 HTML 须至少包含 1 张本站 /uploads/ 配图（`<img src="/uploads/...">`）');
  }
  const src = m[1].trim();
  if (!UPLOAD_MEDIA_SRC_RE.test(src) || src.includes("..")) {
    throw new Error(`非法配图路径：${src}`);
  }
}

/**
 * 按服务端入库流程预检并返回净化后的 title/content，避免 HTTP 灌帖时才暴露 XSS/空正文问题。
 */
export function prepareSyntheticPostForApi(
  title: string,
  html: string,
): { title: string; html: string } {
  assertSyntheticPostLengths(title, html);

  const sanitizedTitle = sanitizeTitleForStorage(title.trim());
  const sanitizedHtml = sanitizeHtmlContentForStorage(html.trim());
  if (!sanitizedTitle || !sanitizedHtml) {
    throw new Error("标题或正文经服务端净化后为空");
  }

  assertSyntheticPostLengths(sanitizedTitle, sanitizedHtml);
  assertSyntheticPostHtmlHasUploadImage(sanitizedHtml);

  return { title: sanitizedTitle, html: sanitizedHtml };
}

/** 从 HTML 抽纯文本摘要，供检索词兜底 */
export function htmlPlainExcerpt(html: string, maxChars: number): string {
  const plain = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.slice(0, Math.max(0, maxChars));
}
