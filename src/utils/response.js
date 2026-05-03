export function success(res, msg, data = {}) {
  return res.json({
    code: 200,
    msg,
    ...data,
  });
}

export function fail(res, statusCode, msg) {
  return res.status(statusCode).json({
    code: statusCode,
    msg,
  });
}
