import { createHttpError } from "./error.middleware.js";

import type { NextFunction, Request, Response } from "express";
import type * as z from "zod";

type ParsedParts = { body?: unknown; query?: unknown; params?: unknown };

//validate 只是一个普通方法，用来包装一个中间件
export function validate<A extends ParsedParts>(schema: z.ZodType<A>) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 用 Zod schema 校验请求参数（body / query / params）
    const result = schema.safeParse({
      body: req.body as unknown,
      query: req.query as unknown,
      params: req.params as unknown,
    });

    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join("; ");
      //校验失败，抛出400, 并进入错误处理中间件
      next(createHttpError(400, message));
      return;
    }

    req.validated = result.data;

    next();
  };
}
