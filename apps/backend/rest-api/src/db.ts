// 数据库文件: 连接 mysql + 初始化 Sequelize 模型

import { Sequelize } from "sequelize";

import { APP_ENV, DB_HOST, DB_PORT, DB_USER, DB_PWD, DB_NAME } from "./env.js";
import { initModels } from "./models/index.js";

// 创建 sequelize 实例
// 并没有立即连接数据库

// 配置对象：存储数据库连接参数（host、port、user、password 等）
// 连接池管理器：初始化连接池（但池为空）
// 查询执行引擎：准备执行 SQL 的基础设施
// 模型注册中心：为后续模型定义做准备
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
