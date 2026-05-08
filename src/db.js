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

const { User, Post, Comment } = initModels(sequelize);

/**
 * 启动时 `authenticate()` 校验连通性（账号、库名、网络等）；失败则抛错，避免拖到首条业务 SQL 才暴露。
 * 仅 development：`sync({ alter: true })` 用 ALTER 尽量对齐已有表与模型，省去手写迁移、适合原型迭代；
 * test / production：不改表。alter 省事但偶尔不够直观，出问题较难排查。
 */
export async function connectDatabase() {
  await sequelize.authenticate();
  if (APP_ENV === "development") {
    // sync 按你代码里的Model定义，尝试让数据库表与模型定义保持一致（建表）
    // alter: true 表示如果表不存在，则创建表；如果表存在，则更新表结构
    await sequelize.sync({ alter: true });
  }
}

export { sequelize, User, Post, Comment };
