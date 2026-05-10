// 统一响应，就是让所有接口给前端返回的数据格式统一
// 这样前端不用每个接口单独猜返回结构，直接根据code和msg就知道返回结果了，方便统一判断

import type { Response } from "express";

export function success(res: Response, msg: string, data: Record<string, unknown> = {}) {
  return res.json({
    code: 200,
    msg,
    ...data,
  });
}

export function fail(res: Response, statusCode: number, msg: string) {
  return res.status(statusCode).json({
    code: statusCode,
    msg,
  });
}
