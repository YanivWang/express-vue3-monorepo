import { UniqueConstraintError } from "sequelize";
import { fail } from "../utils/response.js";

//全局错误处理的核心思想: 业务代码只负责发现错误并抛出错误，然后交给全局错误处理中间件去处理
//全局错误处理中间件，统一决定错误怎么返回给前端，这样前端就不用每个接口单独处理错误了。

export function createHttpError(statusCode, msg) {
  const error = new Error(msg);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

//全局错误格式在 errorMiddleware 里统一
export function errorMiddleware(error, req, res, next) {
  //如果响应头已经发出去了，就不要再在这个中间件里写 fail(res, …)，
  // 而是把错误交给后面的处理链（通常是 Express 自带的兜底）。

  // 头已经发出去了：当前中间件里不能再安全地构造统一 JSON，所以
  // return next(error) 表示：我不处理了，把错误继续往下传，
  // 让 Express（或后面挂载的错误处理）用默认方式处理——常见做法是
  // 记录日志，避免重复写响应。

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

/**
 * 全局错误处理就是把所有 throw 出来的错误，通过 next(error)
 * 汇总到一个中间件里，再由它统一决定状态码、错误信息和响应格式。
 *
 */
