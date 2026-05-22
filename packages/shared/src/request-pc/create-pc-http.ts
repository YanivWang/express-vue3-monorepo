import {
  createHttp,
  type CreateHttpOptions,
  type HttpRequest,
} from "@express-vue3-monorepo/request-core";
import { createTokenStorage, type TokenStorage } from "@express-vue3-monorepo/shared/utils";

import { createElLoadingHandler } from "./loading";
import { createPcHooks, type PcPresetOptions } from "./preset";

export interface CreatePcHttpOptions
  extends Omit<CreateHttpOptions, "tokenProvider" | "loading" | "hooks">, PcPresetOptions {
  /** Token 存储 key；各 app 应传入独立 key（如 `pc_portal_access_token`），默认仅作占位 */
  tokenKey?: string;
  /** Token 存储有效期（天）；JWT 签发 7d，各 app 通常设为 7 */
  tokenExpires?: number;
  /** 已创建好的 token storage 实例（传入后忽略 tokenKey） */
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
    tokenKey = "access_token",
    tokenExpires = 1,
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

  const storage = tokenStorage ?? createTokenStorage({ tokenKey, tokenExpires });

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
