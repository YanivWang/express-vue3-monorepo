import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";

const restApiOrigin =
  process.env.VITE_DEV_PROXY_TARGET?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";

export default defineConfig(({ mode }) => {
  const pcPortalDir = fileURLToPath(new URL(".", import.meta.url));
  const monorepoRoot = path.resolve(pcPortalDir, "../../..");
  const env = loadEnv(mode, pcPortalDir, "");
  const viteEnv = loadEnv(mode, pcPortalDir, "VITE_");
  const target = env.VITE_DEV_PROXY_TARGET?.replace(/\/$/, "") || restApiOrigin;

  const hmrClientRaw = Number(
    process.env.VITE_DEV_HMR_CLIENT_PORT ??
      env.VITE_DEV_HMR_CLIENT_PORT ??
      viteEnv.VITE_DEV_HMR_CLIENT_PORT,
  );
  const hmr =
    Number.isFinite(hmrClientRaw) && hmrClientRaw > 0 ? { clientPort: hmrClientRaw } : undefined;

  const pollingWatch =
    process.env.CHOKIDAR_USEPOLLING === "1"
      ? { usePolling: true, interval: 300 as const }
      : undefined;

  return {
    plugins: [vue()],
    resolve: {
      alias: [{ find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) }],
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      // 经网关反代时 Host 多为浏览器地址，与 pc-admin 对齐，避免 HMR WebSocket 被拒
      allowedHosts: true,
      fs: {
        allow: [monorepoRoot],
      },
      watch: pollingWatch,
      ...(hmr ? { hmr } : {}),
      proxy: {
        "/api": { target, changeOrigin: true },
        "/uploads": { target, changeOrigin: true },
        "/openapi.yaml": { target, changeOrigin: true },
      },
    },
  };
});
