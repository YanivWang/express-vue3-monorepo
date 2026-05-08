import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../env.js";

/** 有 Bearer 则解析并写入 req.user；无 token 或非法则静默跳过（不报错） */
export function optionalAuthMiddleware(req, res, next) {
  const authorization = req.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    return next();
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    // ignore
  }
  return next();
}
