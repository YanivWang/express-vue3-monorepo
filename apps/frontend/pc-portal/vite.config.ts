import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

const restApiOrigin =
  process.env.VITE_DEV_PROXY_TARGET?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");
  const target = env.VITE_DEV_PROXY_TARGET?.replace(/\/$/, "") || restApiOrigin;

  const hmrClientRaw = Number(env.VITE_DEV_HMR_CLIENT_PORT);
  const hmr =
    Number.isFinite(hmrClientRaw) && hmrClientRaw > 0 ? { clientPort: hmrClientRaw } : undefined;

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      ...(hmr ? { hmr } : {}),
      proxy: {
        "/api": { target, changeOrigin: true },
        "/uploads": { target, changeOrigin: true },
        "/openapi.yaml": { target, changeOrigin: true },
      },
    },
  };
});
