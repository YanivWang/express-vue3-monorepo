import { defineConfig } from "vitest/config";

/**
 * 单元测试：纯函数与不依赖外部服务的逻辑，任何机器上都能跑，构成 `pnpm verify` 的一部分。
 * 需要真实 MySQL / Redis 的用例放在 *.integration.test.ts，由 vitest.integration.config.ts 驱动。
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "src/**/*.integration.test.ts"],
  },
});
