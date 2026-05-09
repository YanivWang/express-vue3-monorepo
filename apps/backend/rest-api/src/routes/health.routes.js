import { Router } from "express";
import { sequelize } from "../db.js";

const router = Router();

/** 存活探针：不访问数据库 */
router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

/** 就绪探针：校验数据库连接；失败返回 503 */
router.get("/ready", async (_req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not_ready", message: "database unavailable" });
  }
});

export default router;
