import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sanitizeHtml from "sanitize-html";

import { createHttpError } from "../middlewares/error.middleware.js";

function restApiPackageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export const SENSITIVE_CONTENT_MSG = "包含敏感言论，请删除敏感言论再试试？";

/** 与 img / video / source 的 src 校验一致 */
export const UPLOAD_MEDIA_SRC_RE = /^\/uploads\/[a-zA-Z0-9._/-]+$/;

let cachedWords: string[] | null = null;

export function loadSensitiveWordList(): string[] {
  if (cachedWords) return cachedWords;
  const root = restApiPackageRoot();
  const filePath = path.join(root, "config/sensitive-words.txt");
  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    cachedWords = [];
    return cachedWords;
  }
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  cachedWords = lines;
  return cachedWords;
}

/** 对原始用户输入（应先 trim）做子串检测；命中抛 400 */
export function assertNoSensitiveText(...parts: (string | undefined)[]): void {
  const words = loadSensitiveWordList();
  if (words.length === 0) return;

  for (const part of parts) {
    if (part == null || part === "") continue;
    const lower = part.toLowerCase();
    for (const w of words) {
      const needle = w.trim();
      if (!needle) continue;
      const compareHaystack = /^[a-z0-9_-]+$/i.test(needle) ? lower : part;
      const compareNeedle = /^[a-z0-9_-]+$/i.test(needle) ? needle.toLowerCase() : needle;
      if (compareHaystack.includes(compareNeedle)) {
        throw createHttpError(400, SENSITIVE_CONTENT_MSG);
      }
    }
  }
}

/** 标题：剥离全部 HTML */
export function sanitizeTitleForStorage(title: string): string {
  return sanitizeHtml(title, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}

function sanitizeUploadMediaSrc(src: string | undefined): string | null {
  const trimmed = (src ?? "").trim();
  if (!UPLOAD_MEDIA_SRC_RE.test(trimmed) || trimmed.includes("..")) {
    return null;
  }
  return trimmed;
}

function transformUploadMediaTag(
  tagName: "img" | "video" | "source",
  attribs: sanitizeHtml.Attributes,
): sanitizeHtml.Tag {
  const src = sanitizeUploadMediaSrc(attribs.src);
  if (!src) {
    return { tagName: "span", attribs: {} };
  }

  if (tagName === "img") {
    const alt = (attribs.alt ?? "").trim().slice(0, 500);
    const loading = attribs.loading === "lazy" ? "lazy" : undefined;
    const width = /^\d+$/.test((attribs.width ?? "").trim())
      ? (attribs.width ?? "").trim()
      : undefined;
    const height = /^\d+$/.test((attribs.height ?? "").trim())
      ? (attribs.height ?? "").trim()
      : undefined;
    const next: Record<string, string> = { src, alt };
    if (loading) next.loading = loading;
    if (width) next.width = width;
    if (height) next.height = height;
    return { tagName: "img", attribs: next };
  }

  const next: Record<string, string> = { src };
  if (tagName === "video") {
    next.controls = "true";
    const width = /^\d+$/.test((attribs.width ?? "").trim())
      ? (attribs.width ?? "").trim()
      : undefined;
    const height = /^\d+$/.test((attribs.height ?? "").trim())
      ? (attribs.height ?? "").trim()
      : undefined;
    if (width) next.width = width;
    if (height) next.height = height;
  }
  return { tagName, attribs: next };
}

function transformTaskListInput(
  _tagName: string,
  attribs: sanitizeHtml.Attributes,
): sanitizeHtml.Tag {
  if (attribs.type !== "checkbox") {
    return { tagName: "span", attribs: {} };
  }
  const checked = attribs.checked === "checked" || attribs.checked === "true";
  return {
    tagName: "input",
    attribs: {
      type: "checkbox",
      disabled: "disabled",
      ...(checked ? { checked: "checked" } : {}),
    },
  };
}

const contentAllowedStyles: Record<string, RegExp[]> = {
  "text-align": [/^(left|right|center|justify|start|end)$/],
  color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
  "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
  "font-family": [/^[a-zA-Z0-9\s,"'-]+$/],
  "font-size": [/^\d+(?:\.\d+)?(?:px|em|rem|%)$/],
  "line-height": [/^\d+(?:\.\d+)?(?:px|em|rem|%)?$/],
};

/** 正文：偏向严格白名单（与入库前服务端为准） */
const contentSanitizeOpts: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "div",
    "span",
    "mark",
    "sub",
    "sup",
    "img",
    "video",
    "source",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "colgroup",
    "col",
    "label",
    "input",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "loading", "width", "height"],
    video: ["src", "width", "height", "controls"],
    source: ["src", "type"],
    col: ["span"],
    th: ["colspan", "rowspan", "style", "data-background-color", "data-text-align"],
    td: ["colspan", "rowspan", "style", "data-background-color", "data-text-align"],
    ul: ["data-type"],
    li: ["data-type", "data-checked"],
    label: ["contenteditable"],
    input: ["type", "checked", "disabled", "readonly"],
    code: ["class"],
    pre: ["class"],
    span: ["class", "style", "data-type", "data-latex", "data-block"],
    div: ["class", "style", "data-type", "data-latex", "data-block", "data-align"],
    p: ["style", "data-text-align"],
    h1: ["style", "id", "data-id"],
    h2: ["style", "id", "data-id"],
    h3: ["style", "id", "data-id"],
    h4: ["style", "id", "data-id"],
    h5: ["style", "id", "data-id"],
    h6: ["style", "id", "data-id"],
    mark: ["style", "data-color"],
  },
  allowedSchemesByTag: {
    a: ["http", "https", "mailto"],
  },
  allowedStyles: contentAllowedStyles,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    img: (_tagName, attribs) => transformUploadMediaTag("img", attribs),
    video: (_tagName, attribs) => transformUploadMediaTag("video", attribs),
    source: (_tagName, attribs) => transformUploadMediaTag("source", attribs),
    input: transformTaskListInput,
  },
  exclusiveFilter(frame) {
    if (frame.tag !== "span") return false;
    const cls = frame.attribs.class ?? "";
    // 剥离代码高亮 span，保留内部文本
    return /(?:^|\s)(?:hljs|token)(?:\s|$)/.test(cls);
  },
};

export function sanitizeHtmlContentForStorage(content: string): string {
  return sanitizeHtml(content, contentSanitizeOpts).trim();
}

/** 纯文本评论：无格式化标签 */
export function sanitizePlainTextComment(content: string): string {
  return sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).trim();
}
