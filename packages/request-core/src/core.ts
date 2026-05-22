import axios, { AxiosHeaders } from "axios";

import { HttpCode } from "./types";
import {
  createNormalizedError,
  getRequestKey,
  getRestApiMessage,
  isRecord,
  stripRestApiEnvelope,
  retryDelay,
} from "./utils";

import type {
  RequestConfig,
  CreateHttpOptions,
  TokenProvider,
  LoadingHandler,
  RequestHooks,
  NormalizedError,
} from "./types";
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

  /** 进行中的请求池：key → AbortController */
  private pendingRequests = new Map<string, AbortController>();

  constructor(options: CreateHttpOptions = {}) {
    const {
      baseURL = "",
      timeout = 10000,
      headers = { "Content-Type": "application/json;charset=UTF-8" },
      successCode = 200,
      tokenProvider,
      loading,
      hooks = {},
    } = options;

    this.successCode = successCode;
    this.tokenProvider = tokenProvider;
    this.loading = loading;
    this.hooks = hooks;

    this.instance = axios.create({ baseURL, timeout, headers });
    this.setupInterceptors();
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
