import app from "./app.js";
import { ensureUploadsRoot } from "./config/upload.config.js";
import { connectDatabase, sequelize } from "./db.js";
import { APP_ENV, PORT, SHUTDOWN_TIMEOUT_MS } from "./env.js";
import { connectRedis, disconnectRedis } from "./redis.js";
import { logger, serializeError } from "./utils/logger.js";

await connectDatabase();
await connectRedis();

ensureUploadsRoot();

const server = app.listen(PORT, () => {
  console.log(`服务运行: http://localhost:${PORT}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    const hint =
      APP_ENV === "development"
        ? "已被占用（开发环境可先检查是否尚有旧 nodemon/tsx 未退出）："
        : "已被占用：";
    console.error(`端口 ${String(PORT)} ${hint}${err.message}`);
    process.exit(1);
  }
  throw err;
});

/**
 * 优雅退出——**所有环境**都必须注册，而不只是开发环境。
 *
 * 容器里 node 就是 PID 1，而内核对 PID 1 不施加信号的默认动作：
 * 没有显式 handler 时 SIGTERM 会被直接丢弃。于是 `docker stop` / K8s 滚动更新的表现是
 * 「先白等满 10s 宽限期，再被 SIGKILL 打死」——正在处理的请求连同数据库、Redis 连接一起被硬切。
 * 早期版本只在 development 注册 handler，Dockerfile 里「让 PID 1 收到 SIGTERM」的用心
 * 因此在生产恰恰落空了。
 *
 * 顺序是有讲究的：先停止接受新连接（并踢掉空闲的 keep-alive 连接，否则 server.close()
 * 会一直等到它们自己超时），等在途请求自然结束后，再关闭 Redis 与数据库连接。
 * 超时兜底存在的意义是「卡住的连接不能拖着整个发布」，超时即强制退出并留下日志。
 */
let shuttingDown = false;

async function gracefulShutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info("shutdown_started", { signal, timeoutMs: SHUTDOWN_TIMEOUT_MS });

  const forceExit = setTimeout(() => {
    logger.error("shutdown_timeout", {
      signal,
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
      message: "在途请求或下游连接未能在超时内收尾，强制退出",
    });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  // 兜底定时器本身不应把进程留在事件循环里
  forceExit.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
      // Node ≥18.2：不主动踢掉空闲 keep-alive 连接，close() 会一直挂到它们超时
      server.closeIdleConnections();
    });
    await disconnectRedis();
    await sequelize.close();
    logger.info("shutdown_completed", { signal });
    process.exit(0);
  } catch (error) {
    logger.error("shutdown_failed", { signal, error: serializeError(error) });
    process.exit(1);
  }
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void gracefulShutdown(signal);
  });
}
