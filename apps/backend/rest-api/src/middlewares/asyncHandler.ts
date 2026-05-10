import type { HttpAppError } from "./error.middleware.js";
import type { NextFunction, Request, Response } from "express";

// 异步中间件：若是 async function，await 里的异常不会自动进到 Express4，
// 需要自己 try/catch 再 next(err)，或者用你们那种 asyncHandler 包装。

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>,
  failureMessage?: string,
) {
  // 将 controller 中的异步函数包成中间件，统一 try/catch，把异常交给错误处理中间件
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      // 异步异常在 asyncHandler 里接
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      const httpErr = normalizedError as HttpAppError;
      httpErr.failureMessage = httpErr.failureMessage ?? failureMessage;

      //express 看到 next(error)，就会跳过其它中间件，直接进入错误处理中间件
      next(normalizedError);
    }
  };
}
