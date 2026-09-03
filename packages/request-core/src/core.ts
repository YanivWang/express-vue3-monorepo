import axios, { AxiosHeaders } from "axios";

import { HttpCode } from "./types.js";
import {
  createNormalizedError,
  getRequestKey,
  getRestApiMessage,
  isRecord,
  stripRestApiEnvelope,
  retryDelay,
} from "./utils.js";

import type {
  RequestConfig,
  CreateHttpOptions,
  TokenProvider,
  LoadingHandler,
  RequestHooks,
} from "./types.js";
import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios";

/**
 * UI 无关的 HTTP 核心，响应形态固定为 rest-api：`{ code, msg, ...payload }`。
 */
export class HttpRequest {
  private instance: AxiosInstance;
  private successCode: number;
  private tokenProvider?: TokenProvider;
  private loading?: LoadingHandler;
  private hooks: RequestHooks;
  private refreshAccessToken?: () => Promise<string>;

  /**
   * 进行中的刷新 promise：多个请求同时 401 时只发起一次刷新，其余等待同一结果。
   * 否则一次令牌过期会引发 N 个并发刷新，而刷新是轮换的——后到的那些会拿着已作废的
   * 旧令牌去刷新，反而触发服务端的重放检测把整个会话踢掉。
   */
  private refreshInFlight: Promise<string> | null = null;

  /** 进行中的请求池：key → AbortController */
  private pendingRequests = new Map<string, AbortController>();

  constructor(options: CreateHttpOptions = {}) {
    const {
      baseURL = "",
      timeout = 10000,
      headers = { "Content-Type": "application/json;charset=UTF-8" },
      withCredentials = false,
      successCode = 200,
      tokenProvider,
      loading,
      hooks = {},
      refreshAccessToken,
    } = options;

    this.successCode = successCode;
    this.tokenProvider = tokenProvider;
    this.refreshAccessToken = refreshAccessToken;
    this.loading = loading;
    this.hooks = hooks;

    this.instance = axios.create({ baseURL, timeout, headers, withCredentials });
    this.setupInterceptors();
  }

  /** 刷新去重：并发 401 只触发一次真实刷新，其余请求复用同一个 promise */
  private async performRefresh(): Promise<string> {
    if (!this.refreshAccessToken) {
      throw new Error("未配置 refreshAccessToken");
    }
    this.refreshInFlight ??= this.refreshAccessToken().finally(() => {
      this.refreshInFlight = null;
    });

    const token = await this.refreshInFlight;
    this.tokenProvider?.setToken(token);
    return token;
  }

  private addPending(config: RequestConfig & InternalAxiosRequestConfig): void {
    const key = getRequestKey(config);
    if (this.pendingRequests.has(key)) {
      this.pendingRequests.get(key)!.abort();
      this.pendingRequests.delete(key);
    }
    const controller = new AbortController();
    config.signal = controller.signal;
    this.pendingRequests.set(key, controller);
  }

  private removePending(config: RequestConfig & InternalAxiosRequestConfig): void {
    const key = getRequestKey(config);
    this.pendingRequests.delete(key);
  }

  cancelRequest(key: string): void {
    if (this.pendingRequests.has(key)) {
      this.pendingRequests.get(key)!.abort();
      this.pendingRequests.delete(key);
    }
  }

  cancelAllRequests(): void {
    this.pendingRequests.forEach((controller) => controller.abort());
    this.pendingRequests.clear();
  }

  getAxiosInstance(): AxiosInstance {
    return this.instance;
  }

  private setupInterceptors(): void {
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const customConfig = config as RequestConfig & InternalAxiosRequestConfig;

        if (customConfig.cancelDuplicate) {
          this.addPending(customConfig);
        }

        if (customConfig.showLoading) {
          this.loading?.onStart();
        }

        if (customConfig.withToken !== false) {
          const token = this.tokenProvider?.getToken();
          if (token) {
            const headers = AxiosHeaders.from(config.headers ?? {});
            headers.set("Authorization", `Bearer ${token}`);
            config.headers = headers;
          }
        }

        // 用请求头防缓存，避免 `_t` 等 query 污染后端 Zod `.strict()` 校验
        if (config.method?.toUpperCase() === "GET") {
          const headers = AxiosHeaders.from(config.headers ?? {});
          if (!headers.has("Cache-Control")) {
            headers.set("Cache-Control", "no-cache");
          }
          if (!headers.has("Pragma")) {
            headers.set("Pragma", "no-cache");
          }
          config.headers = headers;
        }

        return config;
      },
      (error: unknown) => Promise.reject(error instanceof Error ? error : new Error(String(error))),
    );

    this.instance.interceptors.response.use(
      (response: AxiosResponse<unknown>) => {
        const { data, config } = response;
        const customConfig = config as RequestConfig & InternalAxiosRequestConfig;

        if (customConfig.cancelDuplicate) this.removePending(customConfig);
        if (customConfig.showLoading) this.loading?.onEnd();

        if (!isRecord(data) || typeof data.code !== "number") {
          const err = createNormalizedError("请求失败", { type: "business", config: customConfig });
          if (customConfig.showError !== false) {
            this.hooks.onBusinessError?.({ error: err, config: customConfig, response });
            this.hooks.onError?.({ error: err, config: customConfig, response });
          }
          return Promise.reject(err);
        }

        if (data.code !== this.successCode) {
          const err = createNormalizedError(getRestApiMessage(data), {
            type: "business",
            code: data.code,
            config: customConfig,
          });
          if (customConfig.showError !== false) {
            this.hooks.onBusinessError?.({ error: err, config: customConfig, response });
            this.hooks.onError?.({ error: err, config: customConfig, response });
          }
          return Promise.reject(err);
        }

        return response;
      },
      async (error: unknown) => {
        if (!axios.isAxiosError(error)) {
          const normalized = createNormalizedError("未知错误", {
            type: "unknown",
            original: error,
          });
          this.hooks.onError?.({ error: normalized });
          return Promise.reject(normalized);
        }

        const { response, config: requestConfig } = error;
        const customConfig = (requestConfig || {}) as RequestConfig & InternalAxiosRequestConfig;

        if (customConfig.cancelDuplicate) this.removePending(customConfig);
        if (customConfig.showLoading) this.loading?.onEnd();

        if (axios.isCancel(error) || error.name === "CanceledError") {
          return Promise.reject(
            createNormalizedError("请求已取消", {
              type: "canceled",
              config: customConfig,
              original: error,
            }),
          );
        }

        if (error.code === "ECONNABORTED") {
          const timeout = createNormalizedError("请求超时，请稍后重试", {
            type: "timeout",
            config: customConfig,
            original: error,
          });
          if (customConfig.showError !== false) {
            this.hooks.onError?.({ error: timeout, config: customConfig, response });
          }
          return Promise.reject(timeout);
        }

        if (!response) {
          const network = createNormalizedError("网络异常，请检查您的网络连接", {
            type: "network",
            config: customConfig,
            original: error,
          });
          if (customConfig.showError !== false) {
            this.hooks.onError?.({ error: network, config: customConfig });
          }
          return Promise.reject(network);
        }

        const { status } = response;
        const unauthorizedStatus: number = HttpCode.UNAUTHORIZED;
        const serverErrorStatus: number = HttpCode.SERVER_ERROR;

        if (status === unauthorizedStatus) {
          const unauthorizedMsg = (): string => {
            if (isRecord(response.data) && typeof response.data.msg === "string") {
              return response.data.msg;
            }
            return "登录已过期";
          };

          /**
           * 访问令牌过期先尝试静默刷新并重放一次。
           *
           * `withToken === false` 的请求直接排除：这类请求本来就没带令牌
           * （登录、注册等），它的 401 只能是「用户名或密码错误」之类的业务结果，
           * 不是令牌过期。对它们刷新既救不了这次请求，还会白白轮换掉当前会话的刷新令牌、
           * 并多消耗一次刷新接口的限流额度。靠每个调用点记得写 skipAuthRefresh 是不牢靠的，
           * 所以这条判断放在这里，让新增的匿名接口自动获得正确行为。
           */
          const canRefresh =
            this.refreshAccessToken !== undefined &&
            customConfig.skipAuthRefresh !== true &&
            customConfig.withToken !== false &&
            customConfig._authRetried !== true;

          if (canRefresh) {
            try {
              const nextToken = await this.performRefresh();
              // customConfig 源自 error.config，其 headers 在运行时已是 AxiosHeaders 实例
              const headers = AxiosHeaders.from(customConfig.headers);
              headers.set("Authorization", `Bearer ${nextToken}`);
              const replay: RequestConfig & InternalAxiosRequestConfig = {
                ...customConfig,
                headers,
                _authRetried: true,
              };
              return await this.instance.request(replay);
            } catch {
              // 刷新失败即会话确实结束，落到下面的常规 401 处理
            }
          }

          const authErr = createNormalizedError(unauthorizedMsg(), {
            type: "auth",
            status,
            config: customConfig,
            original: error,
          });
          if (customConfig.skipUnauthorizedDialog !== true) {
            this.hooks.onUnauthorized?.({ error: authErr, config: customConfig, response });
          }
          return Promise.reject(authErr);
        }

        const retryCount = customConfig.retryCount ?? 0;
        const currentTimes = customConfig._retryTimes ?? 0;
        if (retryCount > 0 && currentTimes < retryCount && status >= serverErrorStatus) {
          customConfig._retryTimes = currentTimes + 1;
          await retryDelay(customConfig._retryTimes, customConfig.retryDelay ?? 1000);
          return this.instance.request(customConfig as InternalAxiosRequestConfig);
        }

        const msgMap: Record<number, string> = {
          [HttpCode.FORBIDDEN]: "没有权限访问该资源",
          [HttpCode.NOT_FOUND]: "请求的资源不存在",
          [HttpCode.SERVER_ERROR]: "服务器内部错误，请稍后重试",
        };
        const body = isRecord(response.data) ? response.data : null;
        const message =
          msgMap[status] || (body ? getRestApiMessage(body) : undefined) || `请求失败（${status}）`;

        const httpErr = createNormalizedError(message, {
          type: "http",
          status,
          config: customConfig,
          original: error,
        });
        if (customConfig.showError !== false) {
          this.hooks.onError?.({ error: httpErr, config: customConfig, response });
        }
        return Promise.reject(httpErr);
      },
    );
  }

  private unwrapResponseBody(data: unknown): unknown {
    if (!isRecord(data)) return data;
    const rest = stripRestApiEnvelope(data);
    return Object.keys(rest).length === 0 ? undefined : rest;
  }

  request<T = unknown>(config: RequestConfig): Promise<T> {
    return this.instance.request(config).then((res) => this.unwrapResponseBody(res.data) as T);
  }

  get<T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    config?: RequestConfig,
  ): Promise<T> {
    return this.request<T>({ ...config, method: "GET", url, params });
  }

  post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "POST", url, data });
  }

  put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "PUT", url, data });
  }

  patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "PATCH", url, data });
  }

  delete<T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    config?: RequestConfig,
  ): Promise<T> {
    return this.request<T>({ ...config, method: "DELETE", url, params });
  }
}

export function createHttp(options: CreateHttpOptions = {}): HttpRequest {
  return new HttpRequest(options);
}
