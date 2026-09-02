import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

import { workspaceSrcAliases } from "../../../scripts/vitest-workspace-src-alias.js";

/**
 * pc-admin 组件单测：与 pc-portal 同构（真实 Element Plus + happy-dom），
 * 差别只在这里没有富文本编辑器需要挡。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [{ find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) }],
  },
  css: {
    // 与 pc-portal 一致：改用 sass 新编译器 API，避免刷屏的 legacy-js-api 弃用告警
    preprocessorOptions: { scss: { api: "modern-compiler" } },
  },
  test: {
    name: "pc-admin",
    environment: "happy-dom",
    include: ["src/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
  },
});
