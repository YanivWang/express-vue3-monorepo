import { defineConfig } from "vitest/config";

/**
 * 集成测试：需要真实 MySQL 与 Redis。
 *
 * 不并行（fileParallelism: false）的原因：
 * 每个测试文件都要建库、跑迁移、启动完整应用，串行执行既省资源，也避免多个文件
 * 同时抢 MySQL 的迁移命名锁而互相等待超时。
 *
 * 超时放宽到 60s：首个文件包含建库 + 全量迁移 + RBAC bootstrap。
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
