import { describe, expect, it } from "vitest";

import { listPostsSchema } from "./post.schema.js";

describe("listPostsSchema", () => {
  it("接受 q 搜索参数", () => {
    const result = listPostsSchema.safeParse({
      query: { page: "1", limit: "10", q: "hello" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.q).toBe("hello");
    }
  });

  it("拒绝已废弃的 keyword 参数（strict）", () => {
    const result = listPostsSchema.safeParse({
      query: { page: "1", limit: "10", keyword: "hello" },
    });
    expect(result.success).toBe(false);
  });

  it("搜索模式下 hot 排序被强制为 latest", () => {
    const result = listPostsSchema.safeParse({
      query: { page: "1", limit: "10", q: "hello", sort: "hot" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.sort).toBe("latest");
    }
  });
});
