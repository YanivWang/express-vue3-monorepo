import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../env.js";
import { createHttpError } from "./error.middleware.js";

export function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token) {
    return next(createHttpError(401, "未登录或登录已过期"));
  }

  try {
    //jwt.verify() 校验，成功后写入 req.user
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    next(createHttpError(401, "未登录或登录已过期"));
  }
}
