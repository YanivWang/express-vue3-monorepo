// 数据库文件: 连接 mysql + 初始化 Sequelize 模型

import { Sequelize } from "sequelize";
import { DB_HOST, DB_USER, DB_PWD, DB_NAME } from "./env.js";
import { initModels } from "./models/index.js";

// 创建 sequelize 实例
// 并没有立即连接数据库

// 配置对象：存储数据库连接参数（host、port、user、password等）
// 连接池管理器：初始化连接池（但池为空）
// 查询执行引擎：准备执行 SQL 的基础设施
// 模型注册中心：为后续模型定义做准备
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PWD, {
  host: DB_HOST,
  dialect: "mysql",
});

const { User } = initModels(sequelize);

// 数据库同步方法
// 遍历所有已定义模型，根据模型定义自动创建或者更新对应数据库表

// alter 修改现有表结构，使其与模型定义保持一致。
sequelize.sync({ alter: true });

export { sequelize, User };
