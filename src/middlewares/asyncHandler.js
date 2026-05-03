export function asyncHandler(fn, failureMessage) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      // 异步异常在 asyncHandler 里接
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      normalizedError.failureMessage = normalizedError.failureMessage ?? failureMessage;
      next(normalizedError);
    }
  };
}
