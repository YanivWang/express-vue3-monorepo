import {
  createHttp,
  type CreateHttpOptions,
  type HttpRequest,
} from "@express-vue3-monorepo/request-core";
import { createTokenStorage, type TokenStorage } from "@express-vue3-monorepo/shared/utils";

import { createElLoadingHandler } from "./loading.js";
import { createPcHooks, type PcPresetOptions } from "./preset.js";

export interface CreatePcHttpOptions
  extends Omit<CreateHttpOptions, "tokenProvider" | "loading" | "hooks">, PcPresetOptions {
  /**
   * 访问令牌存储实例。不传则新建一个内存存储。
   * 注意：不再有 tokenKey / tokenExpires —— 访问令牌已不再持久化到 Cookie，
   * 会话延续改由服务端的 HttpOnly 刷新令牌承担（见 create-app-http.ts）。
   */
  tokenStorage?: TokenStorage;
  /** 覆盖/扩展默认钩子 */
  hooks?: Partial<CreateHttpOptions["hooks"]>;
  /** 是否启用 Loading 默认处理，默认 true */
  enableLoading?: boolean;
  /** 自定义 Loading options（仅在 enableLoading=true 时生效） */
  loadingOptions?: Parameters<typeof createElLoadingHandler>[0];
}

/** 创建 PC 端 HttpRequest：集成 Element Plus 默认 UI 反馈，响应对齐 rest-api `{ code, msg, ... }`。 */
export function createPcHttp(options: CreatePcHttpOptions = {}): HttpRequest {
  const {
    tokenStorage,
    loginPath,
    onLogout,
    authDialog,
    errorDuration,
    hooks: userHooks,
    enableLoading = true,
    loadingOptions,
    ...rest
  } = options;

  const storage = tokenStorage ?? createTokenStorage();

  const presetHooks = createPcHooks(storage, { loginPath, onLogout, authDialog, errorDuration });

  return createHttp({
    ...rest,
    tokenProvider: storage,
    loading: enableLoading ? createElLoadingHandler(loadingOptions) : undefined,
    hooks: { ...presetHooks, ...userHooks },
  });
}

export type { TokenStorage } from "@express-vue3-monorepo/shared/utils";
export type {
  RequestConfig,
  RestApiSuccessJson,
  CreateHttpOptions,
  HttpRequest,
  NormalizedError,
  TokenProvider,
  RequestHooks,
  ErrorHookContext,
  LoadingHandler,
} from "@express-vue3-monorepo/request-core";
