import { SYNTHETIC_IT_HTTP_UA } from "./synthetic-it-constants.js";

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
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || j.code !== 200) {
    throw new Error(`${method} ${url} failed: HTTP ${res.status} ${JSON.stringify(j)}`);
  }
  return j;
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
