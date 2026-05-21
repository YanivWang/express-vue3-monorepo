import { describe, expect, it } from "vitest";

import {
  SENSITIVE_CONTENT_MSG,
  assertNoSensitiveText,
  sanitizeHtmlContentForStorage,
  sanitizePlainTextComment,
  sanitizeTitleForStorage,
} from "./content-safety.js";

describe("content-safety", () => {
  it("assertNoSensitiveText hits configured token", () => {
    expect(() => assertNoSensitiveText("hello __test_sensitive__ foo")).toThrowError(
      SENSITIVE_CONTENT_MSG,
    );
  });

  it("sanitizeTitleForStorage strips HTML tags", () => {
    expect(sanitizeTitleForStorage("<b>x</b>")).toBe("x");
    expect(sanitizeTitleForStorage("  ok  ")).toBe("ok");
  });

  it("sanitizePlainTextComment removes script", () => {
    const out = sanitizePlainTextComment("<script>evil()</script>hi");
    expect(out).not.toMatch(/script/i);
    expect(out).toContain("hi");
  });

  it("sanitizeHtmlContentForStorage drops script but keeps safe tags", () => {
    const html = "<p>Hi</p><script>bad()</script>";
    const out = sanitizeHtmlContentForStorage(html);
    expect(out).toMatch(/Hi/);
    expect(out).not.toMatch(/script/i);
  });

  it("keeps table, task list, and upload media paths", () => {
    const html = [
      "<table><tr><td>cell</td></tr></table>",
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">',
      '<label><input type="checkbox" checked="checked" /></label><div><p>task</p></div></li></ul>',
      '<img src="/uploads/posts/2026/05/a.webp" alt="pic" />',
      '<video src="/uploads/large/2026/05/v.mp4" controls="true"></video>',
    ].join("");
    const out = sanitizeHtmlContentForStorage(html);
    expect(out).toContain("<table>");
    expect(out).toContain('data-type="taskList"');
    expect(out).toContain('type="checkbox"');
    expect(out).toContain('disabled="disabled"');
    expect(out).toContain("/uploads/posts/2026/05/a.webp");
    expect(out).toContain("/uploads/large/2026/05/v.mp4");
  });

  it("strips external and data URLs from media", () => {
    const html =
      '<p><img src="https://evil.com/x.png" /><video src="data:video/mp4;base64,abc"></video></p>';
    const out = sanitizeHtmlContentForStorage(html);
    expect(out).not.toContain("evil.com");
    expect(out).not.toContain("data:video");
  });

  it("preserves math nodes with data-latex", () => {
    const html =
      '<p><span data-type="math" data-latex="E=mc^2" class="math-node math-inline"></span></p>';
    const out = sanitizeHtmlContentForStorage(html);
    expect(out).toContain('data-latex="E=mc^2"');
    expect(out).toContain('data-type="math"');
  });
});
