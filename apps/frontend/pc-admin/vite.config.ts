import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";

const restApiOrigin =
  process.env.VITE_DEV_PROXY_TARGET?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";

function normalizeAssetBase(raw: string | undefined): string {
  const s = raw?.trim() || "/";
  if (s === "" || s === "/") return "/";
  const withSlash = s.endsWith("/") ? s : `${s}/`;
  return withSlash.startsWith("/") ? withSlash : `/${withSlash}`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");
  const viteEnv = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "VITE_");
  const target = env.VITE_DEV_PROXY_TARGET?.replace(/\/$/, "") || restApiOrigin;

  const adminBaseRaw = process.env.VITE_ADMIN_BASE ?? viteEnv.VITE_ADMIN_BASE;
  const base = normalizeAssetBase(adminBaseRaw);

  const hmrClientRaw = Number(
    process.env.VITE_DEV_HMR_CLIENT_PORT ??
      env.VITE_DEV_HMR_CLIENT_PORT ??
      viteEnv.VITE_DEV_HMR_CLIENT_PORT,
  );
  const hmr =
    Number.isFinite(hmrClientRaw) && hmrClientRaw > 0 ? { clientPort: hmrClientRaw } : undefined;

  return {
    base,
    plugins: [vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5174,
      strictPort: true,
      // 经网关反代时 Host 多为浏览器地址；容器网格内直连可能为 pc-admin，避免 Vite 拒答
      allowedHosts: true,
      ...(hmr ? { hmr } : {}),
      proxy: {
        "/api": { target, changeOrigin: true },
        "/uploads": { target, changeOrigin: true },
        "/openapi.yaml": { target, changeOrigin: true },
      },
    },
  };
});
