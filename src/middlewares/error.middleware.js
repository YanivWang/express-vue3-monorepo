import { UniqueConstraintError } from "sequelize";
import { fail } from "../utils/response.js";

//全局错误处理中间件，统一决定错误怎么返回给前端。

export function createHttpError(statusCode, msg) {
  const error = new Error(msg);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

//全局错误格式在 errorMiddleware 里统一
export function errorMiddleware(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof UniqueConstraintError) {
    return fail(res, 409, "用户名已存在");
  }

  console.error(error);

  const statusCode = error.statusCode ?? 500;
  const msg = error.expose ? error.message : (error.failureMessage ?? "服务器内部错误");
  return fail(res, statusCode, msg);
}
