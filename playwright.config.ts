import { defineConfig, devices } from "@playwright/test";

/**
 * 默认（推荐）：不在宿主启动 Node/Vite；假定已通过 Compose 拉起网关，MySQL / rest-api / pc-portal
 * 均在容器内互联，Playwright 只访问宿主上映射的网关端口（与 GATEWAY_HOST_PORT 一致，默认 2026）。
 *
 * 宿主本机直连模式：设置 PLAYWRIGHT_LOCAL_SERVERS=1，将启用 webServer 拉起 pnpm rest-api:dev 与
 * pnpm pc-portal:dev（此时须让宿主进程能连上数据库，例如映射 mysql:3306 到宿主并在 .env.* 中使用 127.0.0.1）。
 *
 * PLAYWRIGHT_BASE_URL 可覆盖任意 baseURL。
 */
const useLocalServers = process.env.PLAYWRIGHT_LOCAL_SERVERS === "1";
const reuse = !process.env.CI && useLocalServers;

const gatewayPort = process.env.PLAYWRIGHT_GATEWAY_PORT ?? process.env.GATEWAY_HOST_PORT ?? "2026";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  (useLocalServers ? "http://127.0.0.1:5173" : `http://127.0.0.1:${gatewayPort}`);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(useLocalServers
    ? {
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
      }
    : {}),
});
