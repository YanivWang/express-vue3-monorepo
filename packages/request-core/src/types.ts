import type {
  AxiosRequestConfig,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

/**
 * 扩展 AxiosRequestConfig，增加自定义业务配置项
 */
export interface RequestConfig extends AxiosRequestConfig {
  /** 是否显示加载动画，默认 false */
  showLoading?: boolean;
  /** 是否显示错误提示，默认 true（由 UI 绑定层 onError 负责展示） */
  showError?: boolean;
  /** 是否携带 Token，默认 true */
  withToken?: boolean;
  /** 为 true 时 401 不触发自动刷新与重试（如登录、登出）；内置 refresh 使用独立 axios，不依赖本字段 */
  skipAuthRefresh?: boolean;
  /** 为 true 时 401 不调用 onUnauthorized（如应用启动拉取 /me，由业务侧静默清会话并跳转登录） */
  skipUnauthorizedDialog?: boolean;
  /** 请求重试次数（仅 5xx 生效） */
  retryCount?: number;
  /** 请求重试间隔（ms） */
  retryDelay?: number;
  /** 内部：当前重试次数 */
  _retryTimes?: number;
  /** 相同 key 的进行中请求自动取消旧请求 */
  cancelDuplicate?: boolean;
  /** 自定义请求唯一键，默认 `${method}:${url}` */
  requestKey?: string;
}

/** 与 monorepo 内 apps/backend/rest-api 默认 JSON 形态对齐（success / fail） */
export type ResponseStyle = "rest-api" | "nested-data";

/**
 * rest-api：扁平载荷，`success(res, msg, data)` 展开为 `code` + `msg` + data 内字段。
 * 参见 `apps/backend/rest-api/src/utils/response.ts`
 */
export type RestApiSuccessJson = Record<string, unknown> & {
  code: number;
  msg: string;
};

/**
 * 旧版或第三方后端：{ code, message, data } 嵌套结构（仍可经 `responseStyle: 'nested-data'` 使用）
 */
export interface NestedResponseData<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** @deprecated 请使用 NestedResponseData */
export type ResponseData<T = unknown> = NestedResponseData<T>;

/** HTTP 状态码（供核心逻辑/绑定层共享） */
export const enum HttpCode {
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  SERVER_ERROR = 500,
}

/** 统一的错误类型（核心层抛出） */
export interface NormalizedError extends Error {
  /** HTTP 状态码（无响应时为空） */
  status?: number;
  /** 业务错误码 */
  code?: number;
  /** 原始错误 */
  original?: unknown;
  /** 原始请求配置 */
  config?: RequestConfig;
  /** 错误类型 */
  type?: "network" | "timeout" | "canceled" | "business" | "auth" | "http" | "unknown";
}

/** Token 提供者（由 UI 绑定层/业务层注入） */
export interface TokenProvider {
  getToken: () => string | undefined | null;
  setToken: (token: string) => void;
  removeToken: () => void;
  getRefreshToken: () => string | undefined | null;
  setRefreshToken: (token: string) => void;
  removeRefreshToken: () => void;
}

/** Loading 钩子（由 UI 绑定层注入） */
export interface LoadingHandler {
  onStart: () => void;
  onEnd: () => void;
}

/** 错误回调上下文 */
export interface ErrorHookContext {
  error: NormalizedError;
  config?: RequestConfig;
  response?: AxiosResponse;
}

/** 刷新 Token 成功后返回的数据结构（字段可扩展） */
export interface RefreshTokenResult {
  accessToken: string;
  refreshToken?: string;
  [key: string]: unknown;
}

/** 构造 HttpRequest 时可注入的钩子集合 */
export interface RequestHooks {
  /** 请求错误（非 401 / 非 canceled）统一回调：UI 层可在此 toast 提示 */
  onError?: (ctx: ErrorHookContext) => void;
  /** 401 无法刷新时回调：UI 层可在此弹窗、跳转登录 */
  onUnauthorized?: (ctx: ErrorHookContext) => void;
  /** 刷新 Token：返回新的 accessToken / refreshToken；核心层保证只并发触发一次 */
  onRefreshToken?: () => Promise<RefreshTokenResult>;
  /** 业务码不匹配时回调（非 HTTP 错误但 code !== successCode） */
  onBusinessError?: (ctx: ErrorHookContext) => void;
}

/** HttpRequest 构造选项 */
export interface CreateHttpOptions {
  /** axios baseURL */
  baseURL?: string;
  /** axios timeout */
  timeout?: number;
  /** 默认请求头 */
  headers?: Record<string, string>;
  /** 业务成功码 */
  successCode?: number;
  /**
   * rest-api：`{ code, msg, ...payload }`（本仓库 express rest-api）
   * nested-data：`{ code, message, data }`
   * @default 'rest-api'
   */
  responseStyle?: ResponseStyle;
  /** 刷新 Token 请求的路径（相对 baseURL），默认 '/auth/refresh' */
  refreshPath?: string;
  /** Token 提供者，默认不注入即禁用自动 Token 注入 */
  tokenProvider?: TokenProvider;
  /** Loading 处理器 */
  loading?: LoadingHandler;
  /** 钩子 */
  hooks?: RequestHooks;
}

export type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig };
