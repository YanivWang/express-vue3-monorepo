/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    blankLayout?: boolean;
  }
}
