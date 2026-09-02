/**
 * 认证 Cookie 的读取与安全属性解析。
 *
 * Express 4 本身不解析 Cookie，通常靠 cookie-parser 中间件；这里只需要读取一个刷新令牌，
 * 为此引入一个中间件并不划算，故就地解析。写入方向用 Express 内置的 `res.cookie` 即可，不需要额外依赖。
 */
import { AUTH_COOKIE_SECURE } from "../env.js";

import { logger } from "./logger.js";

import type { Request } from "express";

/** 按名取一个 Cookie；不存在返回 undefined */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const segment of header.split(";")) {
    const eq = segment.indexOf("=");
    if (eq < 0) continue;
    if (segment.slice(0, eq).trim() !== name) continue;

    const raw = segment.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      // 值不是合法的百分号编码时按原样返回，好过让整个请求失败
      return raw;
    }
  }
  return undefined;
}

/** 明文 HTTP 下发 Secure Cookie 的告警只打一次，避免每次登录都刷屏 */
let insecureSecureCookieWarned = false;

/**
 * 解析本次响应中刷新令牌 Cookie 的 `secure` 取值。
 *
 * `auto` 时按本次请求是否走 HTTPS 判定（`req.secure`；在反向代理后需要 TRUST_PROXY，
 * 否则 Express 读不到 `X-Forwarded-Proto`，会把已经是 HTTPS 的请求误判成明文）。
 *
 * 恒开 Secure 却收到明文请求时，浏览器会**静默丢弃**这枚 Cookie：登录看着成功，
 * 刷新页面却掉登录态，且服务端不会有任何异常日志。所以这里主动把这种配置错位记一条 warn。
 */
export function resolveAuthCookieSecure(req: Request): boolean {
  if (AUTH_COOKIE_SECURE === "auto") {
    return req.secure;
  }

  if (AUTH_COOKIE_SECURE && !req.secure && !insecureSecureCookieWarned) {
    insecureSecureCookieWarned = true;
    logger.warn("auth_cookie_secure_over_plain_http", {
      message:
        "AUTH_COOKIE_SECURE 为开启状态，但本次请求不是 HTTPS：浏览器会丢弃刷新令牌 Cookie，" +
        "表现为「能登录、刷新页面即掉登录态」。请在网关上终止 TLS（并配置 TRUST_PROXY 以便识别 " +
        "X-Forwarded-Proto），或按部署实际设 AUTH_COOKIE_SECURE=auto / 0。",
      protocol: req.protocol,
      trustProxyConfigured: req.app.get("trust proxy") !== undefined,
    });
  }

  return AUTH_COOKIE_SECURE;
}
