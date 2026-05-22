import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv, type Alias } from "vite";

const restApiOrigin =
  process.env.VITE_DEV_PROXY_TARGET?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";

const YANIV_EDITOR_DOCKER_ROOT = "/frontEnd/pixelBloomSpace/tiptapCases/yaniv-editor";

/** 解析 yaniv-editor 源码目录（优先 Docker/本机 YANIV_EDITOR_HOST_PATH，否则读 package.json file:） */
function resolveYanivEditorRoot(pcPortalDir: string): string | null {
  const envPath = process.env.YANIV_EDITOR_HOST_PATH?.trim();
  if (envPath) {
    const resolved = path.resolve(envPath);
    if (existsSync(path.join(resolved, "dist/index.esm.js"))) return resolved;
  }

  const fileRoot = (() => {
    const pkg = JSON.parse(readFileSync(path.join(pcPortalDir, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const spec = pkg.dependencies?.["@yanivjs/yaniv-editor"];
    if (!spec?.startsWith("file:")) return null;
    return path.resolve(pcPortalDir, spec.slice("file:".length));
  })();
  if (fileRoot && existsSync(path.join(fileRoot, "dist/index.esm.js"))) return fileRoot;

  // Docker compose 固定挂载路径（file: 相对路径在容器内可能解析到 /frontEnd/...）
  if (existsSync(path.join(YANIV_EDITOR_DOCKER_ROOT, "dist/index.esm.js"))) {
    return YANIV_EDITOR_DOCKER_ROOT;
  }

  return null;
}

function buildYanivEditorAliases(root: string): Alias[] {
  // 子路径必须写在包入口之前，避免 @yanivjs/yaniv-editor/style.css 被入口 alias 截获
  return [
    {
      find: "@yanivjs/yaniv-editor/style.css",
      replacement: path.join(root, "dist/style.css"),
    },
    {
      find: "@yanivjs/yaniv-editor",
      replacement: path.join(root, "dist/index.esm.js"),
    },
  ];
}

export default defineConfig(({ mode, command }) => {
  const pcPortalDir = fileURLToPath(new URL(".", import.meta.url));
  const monorepoRoot = path.resolve(pcPortalDir, "../../..");
  const isDev = command === "serve";
  const yanivEditorRoot = isDev ? resolveYanivEditorRoot(pcPortalDir) : null;
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

  const resolveAlias: Alias[] = [
    { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ...(yanivEditorRoot != null ? buildYanivEditorAliases(yanivEditorRoot) : []),
  ];

  return {
    plugins: [vue()],
    resolve: {
      alias: resolveAlias,
    },
    optimizeDeps: {
      // 开发态直连 dist，避免 pnpm file: 快照 + 预构建缓存导致编辑器改动不生效
      exclude: isDev && yanivEditorRoot != null ? ["@yanivjs/yaniv-editor"] : [],
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      // 经网关反代时 Host 多为浏览器地址，与 pc-admin 对齐，避免 HMR WebSocket 被拒
      allowedHosts: true,
      fs: {
        allow: yanivEditorRoot != null ? [monorepoRoot, yanivEditorRoot] : [monorepoRoot],
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
