import { Router } from "express";

import { sequelize } from "../db.js";
import { isShuttingDown } from "../lifecycle.js";
import { redis } from "../redis.js";

const router = Router();

/** 存活探针：不访问数据库 */
router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

/**
 * 就绪探针：正在退出、或 MySQL/Redis 不可用时返回 503，并标明各项检查结果。
 *
 * 「正在退出也要报 not_ready」是这条探针的**第一职责**，而不是附带项：
 * 编排层是靠就绪探针决定「还要不要往这个实例发流量」的。收到 SIGTERM 后若它继续答 200，
 * 负载均衡就会一直把请求打到一个马上要关掉监听的进程上——滚动更新期间表现为零星 502，
 * 而进程日志里一切正常（它确实优雅地退出了，只是退出得比 LB 反应更快）。
 *
 * 顺序上先判退出、再探依赖：退出期间下游连接正在关闭，去 ping 它们既没有意义，
 * 又会让本该立刻返回的探针多挂几百毫秒。
 *
 * 注意仅有这一步还不够——探针是轮询的，若翻成 503 之后立刻就关掉监听，
 * 编排层可能根本来不及探到。让这段等待真正发生的是 `SHUTDOWN_DRAIN_MS`（见 env.ts）。
 */
router.get("/ready", async (_req, res) => {
  if (isShuttingDown()) {
    res.status(503).json({
      status: "shutting_down",
      message: "实例正在优雅退出，请勿再向其分发流量",
    });
    return;
  }

  const checks: { mysql: "ok" | "failed"; redis: "ok" | "failed" } = {
    mysql: "failed",
    redis: "failed",
  };

  try {
    await sequelize.authenticate(); //检查mysql是否连接成功
    checks.mysql = "ok";
  } catch {
    checks.mysql = "failed";
  }

  try {
    await redis.ping(); //检查redis是否连接成功
    checks.redis = "ok";
  } catch {
    checks.redis = "failed";
  }

  const ready = checks.mysql === "ok" && checks.redis === "ok";
  if (ready) {
    res.status(200).json({ status: "ready", checks });
    return;
  }

  const failed = (["mysql", "redis"] as const).filter((k) => checks[k] === "failed");
  res.status(503).json({
    status: "not_ready",
    checks,
    message: `依赖不可用：${failed.join("、")}`,
  });
});

export default router;
