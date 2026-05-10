import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../env.js";

import { createHttpError } from "./error.middleware.js";

import type { AppJwtUser } from "../types/jwt-user.js";
import type { NextFunction, Request, Response } from "express";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token) {
    next(createHttpError(401, "未登录或登录已过期"));
    return;
  }

  try {
    //jwt.verify() 校验，成功后写入 req.user
    req.user = jwt.verify(token, JWT_SECRET) as AppJwtUser;
    next();
  } catch {
    next(createHttpError(401, "未登录或登录已过期"));
  }
}
