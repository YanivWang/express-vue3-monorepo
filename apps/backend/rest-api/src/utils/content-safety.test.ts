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
});
