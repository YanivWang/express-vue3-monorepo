import multer from "multer";
import { UniqueConstraintError } from "sequelize";

import { expressRoutePath } from "../utils/expressRoutePath.js";
import { logger, serializeError } from "../utils/logger.js";
import { fail } from "../utils/response.js";

import type { ErrorRequestHandler } from "express";

//全局错误处理的核心思想: 业务代码只负责发现错误并抛出错误，然后交给全局错误处理中间件去处理
//全局错误处理中间件，统一决定错误怎么返回给前端，这样前端就不用每个接口单独处理错误了。

export interface HttpAppError extends Error {
  statusCode?: number;
  expose?: boolean;
  failureMessage?: string;
}

export function createHttpError(statusCode: number, msg: string): HttpAppError {
  const error = new Error(msg) as HttpAppError;
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

/** 仅日志可见详情；返回给客户端的统一文案由 failureMessage 决定 */
export function createInternalServerError(logMessage: string): HttpAppError {
  const error = new Error(logMessage) as HttpAppError;
  error.statusCode = 500;
  error.expose = false;
  error.failureMessage = "服务器内部错误";
  return error;
}

//全局错误格式在 errorMiddleware 里统一
export const errorMiddleware: ErrorRequestHandler = (error, req, res, next) => {
  //如果响应头已经发出去了，就不要再在这个中间件里写 fail(res, …)，
  // 而是把错误交给后面的处理链（通常是 Express 自带的兜底）。

  // 头已经发出去了：当前中间件里不能再安全地构造统一 JSON，所以
  // return next(error) 表示：我不处理了，把错误继续往下传，
  // 让 Express（或后面挂载的错误处理）用默认方式处理——常见做法是
  // 记录日志，避免重复写响应。

  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof multer.MulterError) {
    const map: Record<string, string> = {
      LIMIT_FILE_SIZE: "单文件不超过 5MB",
      LIMIT_FILE_COUNT: "上传文件数量过多",
      LIMIT_UNEXPECTED_FILE: "请使用表单字段名 files 上传",
    };
    fail(res, 400, map[error.code] || error.message);
    return;
  }

  const jpegGuardMsg =
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : undefined;
  if (jpegGuardMsg?.startsWith("仅支持 jpeg")) {
    fail(res, 400, jpegGuardMsg);
    return;
  }

  if (error instanceof UniqueConstraintError) {
    fail(res, 409, "用户名已存在");
    return;
  }

  const httpErr = error as HttpAppError;
  const statusCode = httpErr.statusCode ?? 500;
  const expose = httpErr.expose === true;
  const msg = expose
    ? (httpErr.message ?? "请求处理失败")
    : (httpErr.failureMessage ?? "服务器内部错误");

  //记录错误日志
  //在全局错误中间件中，导入 logger 日志记录器，记录日志
  logger.error("request_error", {
    requestId: req.requestId,
    userId: req.user?.id,
    routePath: expressRoutePath(req),
    error: serializeError(error),
    method: req.method,
    url: req.originalUrl,
    statusCode: statusCode,
    clientMsg: msg,
  });

  fail(res, statusCode, msg);
};
