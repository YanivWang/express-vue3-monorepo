import { ensureUploadsRoot } from "./config/upload.config.js";
import { connectDatabase, sequelize } from "./db.js";
import { APP_ENV, PORT, SHUTDOWN_DRAIN_MS, SHUTDOWN_TIMEOUT_MS } from "./env.js";
import { isShuttingDown, markShuttingDown } from "./lifecycle.js";
import { connectRedis, disconnectRedis } from "./redis.js";
import { logger, serializeError } from "./utils/logger.js";

await connectDatabase();
await connectRedis();

/**
 * 应用在基础设施就绪之后才装配，因此这里是**动态** import，不能改回顶部的静态 import。
 *
 * 静态 import 会先于本文件的任何语句执行 app.ts 的模块体，而模块体里的限流中间件在构造时
 * 就要向 Redis 加载 Lua 脚本；那一刻客户端还没连上，rate-limit-redis 会把这个失败的 promise
 * 缓存下来，之后每次计数都拿到同一个拒绝结果——限流永久失效，且只会安静地放行。
 * 顺序颠倒的代价是「一个安全机制看起来在、其实没在」，所以这条依赖关系必须显式。
 */
const { default: app } = await import("./app.js");

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
async function gracefulShutdown(signal: NodeJS.Signals) {
  // 重入保护与就绪探针共用同一个标志位（lifecycle.ts）：两个含义相同的布尔量迟早会漂移
  if (isShuttingDown()) return;

  /**
   * 第一件事就是把就绪探针翻成 503（见 routes/health.routes.ts），
   * 早于任何连接关闭动作——编排层要靠它决定「还要不要往这里发流量」。
   */
  markShuttingDown();

  logger.info("shutdown_started", {
    signal,
    timeoutMs: SHUTDOWN_TIMEOUT_MS,
    drainMs: SHUTDOWN_DRAIN_MS,
  });

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
    /**
     * 摘流量窗口：`/ready` 已经在答 503，这里留出编排层探到它并把本实例摘掉的时间。
     * 没有这段等待，探针的 503 很可能根本来不及被采集，翻转就白做了。
     * 默认 0（单机 Compose 无滚动更新），K8s 场景应显式配置，见 env.ts。
     */
    if (SHUTDOWN_DRAIN_MS > 0) {
      logger.info("shutdown_draining", {
        signal,
        drainMs: SHUTDOWN_DRAIN_MS,
        message: "就绪探针已置为 not_ready，等待编排层摘除本实例后再停止接受连接",
      });
      await new Promise((resolve) => setTimeout(resolve, SHUTDOWN_DRAIN_MS));
    }

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
