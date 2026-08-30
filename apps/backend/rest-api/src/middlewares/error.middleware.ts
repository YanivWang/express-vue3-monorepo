import multer from "multer";
import { UniqueConstraintError } from "sequelize";

import { expressRoutePath } from "../utils/expressRoutePath.js";
import { logger, serializeError } from "../utils/logger.js";
import { fail } from "../utils/response.js";

import type { ErrorRequestHandler } from "express";

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

export const errorMiddleware: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof multer.MulterError) {
    const map: Record<string, string> = {
      LIMIT_FILE_SIZE: "单文件大小超出限制",
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

  /**
   * 按状态码分级，而不是一律 error。
   *
   * 4xx 是客户端行为（密码输错、校验不通过、访问了不存在的路径），属于系统的正常工作结果；
   * 若同样打成 error 并附带完整堆栈，错误日志会被这些噪声淹没，真正需要人介入的 5xx
   * 反而被埋掉，同时堆栈本身也没有排查价值。
   * 因此：4xx 记 warn 且不带堆栈，5xx 记 error 且保留完整堆栈。
   */
  const isClientError = statusCode >= 400 && statusCode < 500;
  const logPayload = {
    requestId: req.requestId,
    userId: req.user?.id,
    routePath: expressRoutePath(req),
    method: req.method,
    url: req.originalUrl,
    statusCode: statusCode,
    clientMsg: msg,
  };

  if (isClientError) {
    logger.warn("request_client_error", {
      ...logPayload,
      // 仅保留错误信息本身，堆栈对客户端错误无诊断价值
      reason: error instanceof Error ? error.message : String(error),
    });
  } else {
    logger.error("request_error", { ...logPayload, error: serializeError(error) });
  }

  fail(res, statusCode, msg);
};
