import { Sequelize } from "sequelize";

import { APP_ENV, DB_HOST, DB_PORT, DB_USER, DB_PWD, DB_NAME } from "./env.js";
import { initModels } from "./models/index.js";

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PWD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: "mysql",
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

/**
 * 启动时 `authenticate()` 校验连通性（账号、库名、网络等）；失败则抛错，避免拖到首条业务 SQL 才暴露。
 * development：默认 `sync({ alter: true })`；`DB_SYNC_ALTER=0` 时不 alter（仅建缺表）。
 * test / production：仅 `sync()`，不 alter。
 * 本地/开发若改模型与库不一致，可 `pnpm db:drop-create` 后重启，由 sync + RBAC bootstrap 重建；不在此做历史数据回填。
 */
export async function connectDatabase() {
  await sequelize.authenticate();
  if (APP_ENV === "development") {
    const alter = process.env.DB_SYNC_ALTER !== "0";
    await sequelize.sync(alter ? { alter: true } : {});
  } else {
    await sequelize.sync();
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
