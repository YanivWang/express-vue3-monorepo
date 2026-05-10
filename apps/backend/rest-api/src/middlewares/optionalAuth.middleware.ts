import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../env.js";

import type { AppJwtUser } from "../types/jwt-user.js";
import type { NextFunction, Request, Response } from "express";

/** 有 Bearer 则解析并写入 req.user；无 token 或非法则静默跳过（不报错） */
export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    next();
    return;
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as AppJwtUser;
  } catch {
    // token 无效：不设置 req.user，按匿名请求继续
  }
  next();
}
