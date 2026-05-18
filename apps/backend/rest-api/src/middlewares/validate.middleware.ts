import { createHttpError } from "./error.middleware.js";

import type { NextFunction, Request, Response } from "express";
import type * as z from "zod";

type ParsedParts = { body?: unknown; query?: unknown; params?: unknown };

// 工厂函数：返回带 Zod 校验的请求中间件，成功后写入 req.validated
export function validate<A extends ParsedParts>(schema: z.ZodType<A>) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 用 Zod schema 校验请求参数（body / query / params）
    const result = schema.safeParse({
      body: req.body as unknown,
      query: req.query as unknown,
      params: req.params as unknown,
      headers: req.headers,
    });

    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join("; ");
      // 校验失败：400，交由全局 error 中间件输出统一错误体
      next(createHttpError(400, message));
      return;
    }

    req.validated = result.data;

    next();
  };
}
