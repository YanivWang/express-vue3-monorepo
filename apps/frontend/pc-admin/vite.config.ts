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
    css: {
      // Vite 5 默认走 Sass 的 legacy JS API（Dart Sass 2.0 将移除），构建时每个 SCSS
      // 入口都会刷一条 legacy-js-api 弃用告警；verify 要求零 warning，故切到新编译器 API。
      // 与 vitest.config.ts 取同一个值，避免测试与构建用两套 Sass 实现。
      preprocessorOptions: {
        scss: { api: "modern-compiler" as const },
      },
    },
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
