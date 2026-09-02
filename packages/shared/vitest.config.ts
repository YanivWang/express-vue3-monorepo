import { defineConfig } from "vitest/config";

/**
 * 本包只有一处「不看代码就说不清」的运行时行为：会话恢复的刷新请求
 * （跨标签页串行化、超时、携带 Cookie）。它同时是两个前端 app 登录态的根，
 * 出问题的表现却是「偶发掉登录」或「白屏」这类难以复现的症状，因此值得有测试守着。
 *
 * node 环境即可：用例把 fetch 与 navigator.locks 都换成可控替身，不需要真实 DOM。
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
