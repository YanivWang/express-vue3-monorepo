/**
 * 请求 Cookie 读取。
 *
 * Express 4 本身不解析 Cookie，通常靠 cookie-parser 中间件；这里只需要读取一个刷新令牌，
 * 为此引入一个中间件并不划算，故就地解析。写入方向用 Express 内置的 `res.cookie` 即可，不需要额外依赖。
 */
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
