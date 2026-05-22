/** 封面图最大 5MB（与发布页提示一致） */
export const POST_COVER_MAX_BYTES = 5 * 1024 * 1024;

export const POST_COVER_ACCEPT = "image/jpeg,image/png,image/jpg";

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** 去掉正文开头的专用封面段落 */
export function stripPostCoverBlock(html: string): string {
  return html.replace(/^\s*<p[^>]*data-post-cover=["']1["'][^>]*>[\s\S]*?<\/p>\s*/i, "").trim();
}

/** 从 HTML 解析封面与正文（专用封面块优先，否则取首张图仅作展示） */
export function parseEditorContent(html: string): { coverUrl: string | null; bodyHtml: string } {
  const trimmed = (html ?? "").trim() || "<p></p>";
  const dedicated = trimmed.match(/^\s*<p[^>]*data-post-cover=["']1["'][^>]*>[\s\S]*?<\/p>/i);
  if (dedicated) {
    const src = dedicated[0].match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
    const bodyHtml = stripPostCoverBlock(trimmed) || "<p></p>";
    return { coverUrl: src, bodyHtml };
  }
  const firstImg = trimmed.match(/<img[^>]+src=["']([^"']+)["']/i);
  return { coverUrl: firstImg?.[1] ?? null, bodyHtml: trimmed };
}

function removeLeadingImgParagraph(html: string, src: string): string {
  const esc = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html
    .replace(
      new RegExp(`^\\s*<p[^>]*>\\s*<img[^>]+src=["']${esc}["'][^>]*\\s*/?>\\s*</p>\\s*`, "i"),
      "",
    )
    .trim();
}

/** 保存前将封面插入正文首部，供列表 cardCoverUrl 读取首张图 */
export function mergeCoverIntoContent(
  html: string,
  coverUrl: string | null,
  title: string,
): string {
  let body = stripPostCoverBlock(html);
  const src = coverUrl?.trim();
  if (!src) return body || "<p></p>";
  body = removeLeadingImgParagraph(body, src);
  const alt = escapeHtmlAttr(title.trim() || "封面");
  const safeSrc = escapeHtmlAttr(src);
  const block = `<p data-post-cover="1"><img src="${safeSrc}" alt="${alt}" loading="lazy"/></p>`;
  return `${block}${body}`;
}

export function validateCoverFile(file: File): string | null {
  if (!/^image\/(jpeg|png|jpg)$/i.test(file.type)) {
    return "仅支持 JPG/PNG 格式";
  }
  if (file.size > POST_COVER_MAX_BYTES) {
    return "封面图大小不能超过 5MB";
  }
  return null;
}
