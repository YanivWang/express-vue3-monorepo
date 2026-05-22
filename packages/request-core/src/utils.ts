import type { RequestConfig, NormalizedError } from "./types";

export function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}

export function getRestApiMessage(data: Record<string, unknown>): string {
  // 优先 `msg`（rest-api 标准字段）；`message` 为历史兼容回退
  const m = data.msg ?? data.message;
  return typeof m === "string" && m.length > 0 ? m : "请求失败";
}

/** 去掉 rest-api 元字段，剩余即为业务载荷 */
export function stripRestApiEnvelope(data: Record<string, unknown>): Record<string, unknown> {
  const { code: _code, msg: _msg, message: _message, ...rest } = data;
  return rest;
}

/** 指数退避延迟 */
export function retryDelay(times: number, baseDelay = 1000): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(2, times - 1)));
}

/** 创建统一的 NormalizedError */
export function createNormalizedError(
  message: string,
  init: Partial<NormalizedError> = {},
): NormalizedError {
  const err = new Error(message) as NormalizedError;
  Object.assign(err, init);
  return err;
}

/** 生成请求唯一键 */
export function getRequestKey(config: RequestConfig): string {
  return config.requestKey ?? `${(config.method ?? "get").toUpperCase()}:${config.url ?? ""}`;
}
