//一个普通的中间件长这样: 必须三个参数

// 不完全是「必须」，但语义上要 二选一：要么 next()，要么
// 自己对 res 结束这次请求。两者都不做，请求会一直挂在那儿。
export function exampleMiddleware(req, res, next) {
  console.log("example middleware");
  //如果一切顺利，就调用 next() 继续下一个中间件
  next(); //正常向下传递=>（继续走后面的中间件或路由处理函数）。不要再往下走时就不该随便再 next()

  // next(new Error(...)) //如果遇到错误，就调用 next(new Error(...)) 传给错误处理中间件
  // 如果直接 next(error)了，express看到，就会跳过其它中间件，直接进入错误处理中间件
}

//错误中间件长这样: 必须四个参数
export function errorMiddleware(error, req, res, next) {
  console.error(error);

  //如果响应头已经发出去了，就不要再在这个中间件里写 fail(res, …)，
  // 而是把错误交给后面的处理链（通常是 Express 自带的兜底）。
  if (res.headersSent) {
    return next(error);
  }
  //如果响应头还没发出，那就构造一个统一 JSON 返回
  return fail(res, 500, "服务器内部错误");
}
