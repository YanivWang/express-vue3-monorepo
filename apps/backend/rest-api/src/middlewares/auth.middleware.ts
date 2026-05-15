import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../env.js";
import { isJwtBlacklisted } from "../services/auth-token.service.js";

import { createHttpError } from "./error.middleware.js";

import type { AppJwtUser } from "../types/jwt-user.js";
import type { NextFunction, Request, Response } from "express";

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token) {
    next(createHttpError(401, "未登录或无效登录凭证"));
    return;
  }

  try {
    // 一: 先校验JWT是否有效
    // Bearer JWT：verify 成功后把载荷写入 req.user（类型见 AppJwtUser）
    // 从用户token解析出用户信息
    const user = jwt.verify(token, JWT_SECRET) as AppJwtUser;

    // 二: 检查JWT是否包含jti
    if (!user.jti) {
      next(createHttpError(401, "无效登录凭证"));
      return;
    }

    // 三：检查JWT是否在黑名单中
    // 若在黑名单中，则认为该JWT已失效
    const blacklisted = await isJwtBlacklisted(user.jti);
    if (blacklisted) {
      next(createHttpError(401, "登录已过期, 请重新登录"));
      return;
    }

    req.user = user;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(createHttpError(401, "登录已过期, 请重新登录"));
      return;
    }

    next(createHttpError(401, "无效登录凭证"));
  }
}
