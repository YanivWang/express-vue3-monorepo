/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
  readonly VITE_DEV_HMR_CLIENT_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    title?: string;
    /** 需登录，否则重定向 /login（见 router/index.ts 的 beforeEach） */
    requiresAuth?: boolean;
    /** 仅未登录可访问（登录/注册），已登录则重定向 / */
    guestOnly?: boolean;
    /** 不套 AppShell 站点壳层（编辑器与 demo 页） */
    blankLayout?: boolean;
  }
}
