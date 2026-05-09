import { randomUUID } from "node:crypto";

const HEADER = "x-request-id";

/** 透传客户端 X-Request-Id，否则生成 UUID，并写回响应头便于追踪 */
export function requestIdMiddleware(req, res, next) {
  const incoming = req.get(HEADER);
  const id =
    incoming && String(incoming).trim()
      ? String(incoming).trim().slice(0, 128)
      : randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}
