import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

/**
 * pc-portal 组件单测：真实挂载 Element Plus，只在「外部系统」处设挡板
 * （HTTP 由各用例 vi.mock @/api/*，富文本编辑器见 src/test/stubs/yaniv-editor.ts）。
 *
 * 这些用例是组件拆分的安全网：拆分前写、拆分后一行不改地继续跑，
 * 因此断言一律走渲染结果与对外调用，不碰组件内部的 ref/方法。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      // 富文本编辑器是第三方 ProseMirror 重组件，且非本次重构对象；
      // 真身在 happy-dom 下既慢又脆，替换为最小挡板以保留「宿主怎么用它」的可断言性。
      {
        find: /^@yanivjs\/yaniv-editor$/,
        replacement: fileURLToPath(new URL("./src/test/stubs/yaniv-editor.ts", import.meta.url)),
      },
    ],
  },
  css: {
    // 改用 sass 新编译器 API，避免每次跑测试都刷一屏 legacy-js-api 弃用告警。
    // 注：vite.config.ts（应用构建）目前仍走旧 API、同样会告警，那是既有问题，不在本次改动范围内。
    preprocessorOptions: { scss: { api: "modern-compiler" } },
  },
  test: {
    name: "pc-portal",
    environment: "happy-dom",
    include: ["src/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
  },
});
