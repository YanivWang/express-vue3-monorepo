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

/**
 * 开发环境给 sequelize.sync 配上 alter: true，主要的好处是：不用手写迁移，也能让「库里已有的表」尽量跟模型定义对上。

具体来说：

改模型就能改表结构
给字段改名、加减字段、改类型、allowNull、defaultValue、简单 unique 等，启动时 Sequelize 会尝试用 ALTER TABLE 把表对齐，
省掉「改一次模型就写一段 SQL/迁移」的摩擦。

适合原型和自学项目
表还没定型、数据结构经常大变时，alter 能快速迭代，减少来回切终端跑 migration 的步骤。

表已存在时仍能「修补」结构
默认 sync() 不会做破坏性对齐；alter: true 才有「对齐现有表」的行为（实现上是一直查 INFORMATION_SCHEMA，再决定要改哪些列）。
 * 
 * 简明结论：好处 = 开发阶段省事、迭代快；代价 = 行为有时不可预期、出问题难排查。
 */
