import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sanitizeHtml from "sanitize-html";

import { createHttpError } from "../middlewares/error.middleware.js";

function restApiPackageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export const SENSITIVE_CONTENT_MSG = "包含敏感言论，请删除敏感言论再试试？";

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
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
  },
  allowedSchemesByTag: {
    a: ["http", "https", "mailto"],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
};

export function sanitizeHtmlContentForStorage(content: string): string {
  return sanitizeHtml(content, contentSanitizeOpts).trim();
}

/** 纯文本评论：无格式化标签 */
export function sanitizePlainTextComment(content: string): string {
  return sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).trim();
}
