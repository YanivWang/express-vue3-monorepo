// 异步中间件：若是 async function，await 里的异常不会自动进到 Express4，
// 需要自己 try/catch 再 next(err)，或者用你们那种 asyncHandler 包装。

export function asyncHandler(fn, failureMessage) {
  // asyncHandler 把controller中的异步函数包装成一个中间件
  // 统一加上try catch
  // 来捕获异步函数中的错误，并交个错误中间件处理，核心功能就是帮 controller，中async函数接住错误
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      // 异步异常在 asyncHandler 里接
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      normalizedError.failureMessage = normalizedError.failureMessage ?? failureMessage;

      //express 看到 next(error)，就会跳过其它中间件，直接进入错误处理中间件
      next(normalizedError);
    }
  };
}
