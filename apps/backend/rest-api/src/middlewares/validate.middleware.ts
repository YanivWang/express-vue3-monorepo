import { createHttpError } from "./error.middleware.js";

import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

//validate 只是一个普通方法，用来包装一个中间件
export function validate(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    //用scheme校验请求参数
    //body
    //query
    //params
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join("; ");
      //校验失败，抛出400, 并进入错误处理中间件
      next(createHttpError(400, message));
      return;
    }

    const data = result.data as {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    };

    //把 Zod 处理后的干净数据重新放回 req，后面的 controller/service 拿到的就是清洗后的数据。
    req.body = (data.body ?? req.body);
    req.query = (data.query ?? req.query) as typeof req.query;
    req.params = (data.params ?? req.params) as typeof req.params;

    next();
  };
}
