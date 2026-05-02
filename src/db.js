// 数据库文件: 连接mysql + 创建用户表

import { Sequelize, DataTypes } from "sequelize";
import dotenv from "dotenv";

//加载 .env 文件中环境变量到 process.env 中
//为了安全的管理敏感信息
dotenv.config();

const { DB_HOST, DB_USER, DB_PWD, DB_NAME } = process.env;

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

//定义模型 => 数据库的一张表
//User 是模型名 => 复数化(Users) 是表名
const User = sequelize.define("User", {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, //唯一约束
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// 数据库同步方法
// 遍历所有已定义模型，根据模型定义自动创建或者更新对应数据库表

// alter 修改现有表结构，使其与模型定义保持一致。
sequelize.sync({ alter: true });

export { sequelize, User };
