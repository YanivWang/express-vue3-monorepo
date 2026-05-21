import DOMPurify from "dompurify";

import type { UponSanitizeAttributeHookEvent } from "dompurify";

/**
 * 帖子正文展示净化（须与 rest-api `content-safety.ts` 策略对齐，后端入库为准）。
 */
const UPLOAD_MEDIA_SRC_RE = /^\/uploads\/[a-zA-Z0-9._/-]+$/;

let domPurifyHooksReady = false;

function isAllowedMediaSrc(value: string | null | undefined): boolean {
  const src = (value ?? "").trim();
  return UPLOAD_MEDIA_SRC_RE.test(src) && !src.includes("..");
}

function ensureDomPurifyHooks() {
  if (domPurifyHooksReady) return;
  domPurifyHooksReady = true;

  DOMPurify.addHook(
    "uponSanitizeAttribute",
    (node: Element, data: UponSanitizeAttributeHookEvent) => {
      if (
        data.attrName === "src" &&
        (node.tagName === "IMG" || node.tagName === "VIDEO" || node.tagName === "SOURCE")
      ) {
        if (!isAllowedMediaSrc(data.attrValue)) {
          data.keepAttr = false;
          data.attrValue = "";
        }
      }
      if (data.attrName === "type" && node.tagName === "INPUT" && data.attrValue !== "checkbox") {
        data.keepAttr = false;
      }
    },
  );

  DOMPurify.addHook("afterSanitizeAttributes", (node: Element) => {
    if (node.tagName === "INPUT" && node.getAttribute("type") === "checkbox") {
      node.setAttribute("disabled", "disabled");
    }
    if (node.tagName === "A") {
      node.setAttribute("rel", "noopener noreferrer");
      node.setAttribute("target", "_blank");
    }
  });
}

export function sanitizePostBodyHtml(raw: string): string {
  ensureDomPurifyHooks();
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
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
    ALLOWED_ATTR: [
      "href",
      "title",
      "rel",
      "target",
      "src",
      "alt",
      "loading",
      "width",
      "height",
      "controls",
      "type",
      "checked",
      "disabled",
      "readonly",
      "colspan",
      "rowspan",
      "class",
      "style",
      "id",
      "data-type",
      "data-checked",
      "data-latex",
      "data-block",
      "data-align",
      "data-background-color",
      "data-text-align",
      "data-id",
      "data-color",
      "contenteditable",
      "span",
    ],
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ["script", "iframe", "object", "embed"],
    FORBID_ATTR: ["onerror", "onclick", "onload"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/uploads\/)/i,
  });
}
