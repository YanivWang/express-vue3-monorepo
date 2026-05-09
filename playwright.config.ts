import { defineConfig, devices } from "@playwright/test";

/**
 * 根目录 Playwright：驱动 pc-portal（5173），依赖 rest-api（3000）与可用 MySQL。
 * 运行前请先起数据库栈（如 `pnpm docker:test`）或等价本地 MySQL，否则 API 无法在 listen 前完成连库。
 */
const reuse = !process.env.CI;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm rest-api:dev",
      url: "http://127.0.0.1:3000/health",
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
    {
      command: "pnpm pc-portal:dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
  ],
});
