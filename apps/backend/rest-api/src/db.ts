import { Sequelize } from "sequelize";

import { runMigrations } from "./db/migrator.js";
import { APP_ENV, DB_HOST, DB_PORT, DB_USER, DB_PWD, DB_NAME } from "./env.js";
import { initModels } from "./models/index.js";
import { logger } from "./utils/logger.js";

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PWD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: "mysql",
  /**
   * Sequelize 默认把每条 SQL 直接 console.log 到 stdout：生产环境既刷屏又会把 INSERT 的字面量
   * （含用户名等）写进日志流。这里改为走统一 logger 的 debug 级别，
   * 默认（LOG_LEVEL=info）不输出，需要排查时才 LOG_LEVEL=debug 打开。
   */
  logging: (sql: string) => {
    logger.debug("sequelize_query", { sql });
  },
});

const {
  User,
  UserProfile,
  Category,
  Post,
  PostVote,
  PostFavorite,
  Comment,
  Permission,
  Role,
  RolePermission,
} = initModels(sequelize);

/** `DB_AUTO_MIGRATE=0` 时跳过启动期迁移，交由独立的部署步骤执行（见下方说明） */
function autoMigrateEnabled(): boolean {
  return process.env.DB_AUTO_MIGRATE !== "0";
}

/**
 * 启动时先 `authenticate()` 校验连通性（账号、库名、网络等），失败即抛错，
 * 避免拖到首条业务 SQL 才暴露。
 *
 * 表结构由 `src/migrations/*` 版本化管理，**任何环境都不再调用 `sequelize.sync()`**。
 * 历史上 development 用 `sync({ alter: true })`、test/production 用 `sync()`，导致：
 *   - 生产改字段静默不生效，代码与库结构长期漂移；
 *   - 开发库不断累积重复索引，需要 scripts/dedupe-mysql-redundant-indexes.ts 事后擦除；
 *   - 变更无版本、无法回滚、无法评审。
 *
 * 多副本部署时启动期迁移由 MySQL 命名锁串行化（见 db/migrator.ts）。
 * 若你的发布流程更希望把迁移作为独立步骤（init container / 发布前 job），
 * 设 `DB_AUTO_MIGRATE=0` 并在部署流水线中执行 `pnpm db:migrate`。
 */
export async function connectDatabase() {
  await sequelize.authenticate();

  if (autoMigrateEnabled()) {
    const executed = await runMigrations(sequelize);
    if (executed.length > 0) {
      logger.info("migration_startup_completed", { executed, appEnv: APP_ENV });
    }
  } else {
    logger.info("migration_skipped_by_env", {
      message: "DB_AUTO_MIGRATE=0，启动期不执行迁移；请确认部署流程已单独执行 pnpm db:migrate",
    });
  }

  const { bootstrapRbacIfNeeded } = await import("./services/rbac-bootstrap.service.js");
  await bootstrapRbacIfNeeded();
}

export {
  sequelize,
  User,
  UserProfile,
  Category,
  Post,
  PostVote,
  PostFavorite,
  Comment,
  Permission,
  Role,
  RolePermission,
};
