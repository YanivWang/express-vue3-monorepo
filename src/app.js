// 主文件: 启动服务 + 写接口

import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
// es 模块中导入本地文件时，必须包含完整的文件扩展名，node.js 不会自动解析 .js .json 等扩展名
import { User } from "./db.js";
import dotenv from "dotenv";

import { setupSwagger } from "./swagger.js";

// 加载环境变量，把 .env 文件中的键值对注入到 process.env 对象中
dotenv.config();

//创建服务
const app = express();

//使用中间件
app.use(cors());
app.use(express.json());

// Swagger UI：/api-docs ；契约文件：docs/openapi.yaml ，运行时可 GET /openapi.yaml 给 Apifox 导入
setupSwagger(app);

// 业务接口 ======================================

app.post("/api/register", async (req, res) => {
  const { username, password, nickname } = req.body;
  const hashPwd = await bcrypt.hash(password, 10);
  await User.create({ username, password: hashPwd, nickname });

  res.json({ code: 200, msg: "注册成功" });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = User.findOne({ where: { username } });
  if (!user) {
    return res.json({ code: 401, msg: "用户不存在" });
  }

  const isRight = bcrypt.compare(password, user.password);
  if (!isRight) {
    return res.json({ code: 401, msg: "密码错误" });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
  res.json({ code: 200, msg: "登录成功", token });
});

app.listen(process.env.PORT, () => {
  console.log(`服务运行: http://localhost:${process.env.PORT} `);
});
