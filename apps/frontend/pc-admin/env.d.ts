/// <reference types="vite/client" />

import "vue-router";

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
  readonly VITE_DEV_HMR_CLIENT_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "vue-router" {
  interface RouteMeta {
    title?: string;
    permissions?: readonly string[];
  }
}
