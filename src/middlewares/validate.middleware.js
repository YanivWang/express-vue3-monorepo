import { createHttpError } from "./error.middleware.js";

//validate 只是一个普通方法，用来包装一个中间件
export function validate(schema) {
  return (req, res, next) => {
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
      return next(createHttpError(400, message));
    }

    //把 Zod 处理后的干净数据重新放回 req，后面的 controller/service 拿到的就是清洗后的数据。
    req.body = result.data.body ?? req.body;
    req.query = result.data.query ?? req.query;
    req.params = result.data.params ?? req.params;

    return next();
  };
}
