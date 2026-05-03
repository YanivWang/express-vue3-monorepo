import { UniqueConstraintError } from "sequelize";
import { fail } from "../utils/response.js";

export function createHttpError(statusCode, msg) {
  const error = new Error(msg);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

export function errorMiddleware(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof UniqueConstraintError) {
    return fail(res, 409, "用户名已存在");
  }

  console.error(error);

  const statusCode = error.statusCode ?? 500;
  const msg = error.expose ? error.message : error.failureMessage ?? "服务器内部错误";
  return fail(res, statusCode, msg);
}
