import { SYNTHETIC_IT_HTTP_UA } from "./synthetic-it-constants.js";

const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiRetryMax(): number {
  const raw = process.env.SYNTHETIC_API_RETRY_MAX?.trim();
  if (!raw) return 10;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 10;
}

function apiRetryDelayMs(): number {
  const raw = process.env.SYNTHETIC_API_RETRY_MS?.trim();
  if (!raw) return 1500;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 1500;
}

function isTransientApiFailure(status: number, payload: Record<string, unknown>): boolean {
  if (TRANSIENT_HTTP_STATUSES.has(status)) return true;
  // Nginx 502 有时仍返回空 JSON；业务层 5xx 也视为可重试
  return status >= 500 && payload.code == null;
}

export async function apiSuccessJson(
  method: string,
  apiBase: string,
  token: string,
  pathname: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const url = `${apiBase.replace(/\/$/, "")}${pathname}`;
  const headers: Record<string, string> = {
    "User-Agent": SYNTHETIC_IT_HTTP_UA,
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const maxAttempts = apiRetryMax() + 1;
  const retryDelayMs = apiRetryDelayMs();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok && j.code === 200) {
        return j;
      }

      if (attempt < maxAttempts && isTransientApiFailure(res.status, j)) {
        console.warn(
          `[synthetic-it] ${method} ${url} HTTP ${res.status}，${retryDelayMs}ms 后重试（${attempt}/${maxAttempts - 1}）`,
        );
        await sleep(retryDelayMs);
        continue;
      }

      throw new Error(`${method} ${url} failed: HTTP ${res.status} ${JSON.stringify(j)}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      const retryable =
        attempt < maxAttempts &&
        (err.message.includes("fetch failed") ||
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("ECONNRESET") ||
          err.message.includes("socket hang up"));
      if (!retryable) {
        throw err;
      }
      console.warn(
        `[synthetic-it] ${method} ${url} 网络异常：${err.message}；${retryDelayMs}ms 后重试（${attempt}/${maxAttempts - 1}）`,
      );
      await sleep(retryDelayMs);
    }
  }

  throw lastError ?? new Error(`${method} ${url} failed after retries`);
}

/** 不设 REST_API_IMPORT_TOKEN 时：`POST …/login`（须为管理员）。 */
export async function loginForAdminJwt(
  apiBase: string,
  username: string,
  password: string,
): Promise<string> {
  const url = `${apiBase.replace(/\/$/, "")}/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": SYNTHETIC_IT_HTTP_UA,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof j.token === "string" ? j.token.trim() : "";
  if (!res.ok || j.code !== 200 || !token) {
    throw new Error(`POST ${url}（导入种子登录）失败：HTTP ${res.status} ${JSON.stringify(j)}`);
  }
  return token;
}
