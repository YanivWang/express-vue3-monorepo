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

//异步路由需要加 try,catch 处理错误, 否则一旦出错会变成 未处理的 Promise 拒绝
//客户端可能一直等不到响应或进程日志里报错
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    //入参校验（请求入参必须校验，防止非法数据进入数据库）
    if (!username.trim() || !password.trim()) {
      return res.json({ code: 400, msg: "用户名或密码不能为空" });
    }

    const hashPwd = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashPwd });

    res.json({ code: 200, msg: "注册成功" });
  } catch (error) {
    console.error(error); //打印服务端日志，帮助排查错误
    res.json({ code: 500, msg: "注册失败" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    //入参校验（请求入参必须校验，防止非法数据进入数据库）
    if (!username.trim() || !password.trim()) {
      return res.json({ code: 400, msg: "用户名或密码不能为空" });
    }

    const user = await User.findOne({ where: { username } });
    if (!user) {
      //HTTP 状态码习惯
      return res.status(401).json({ code: 401, msg: "用户不存在" });
    }

    const isRight = await bcrypt.compare(password, user.password);
    if (!isRight) {
      return res.status(401).json({ code: 401, msg: "密码错误" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({ code: 200, msg: "登录成功", token });
  } catch (error) {
    console.error(error); //打印服务端日志，帮助排查错误
    res.json({ code: 500, msg: "登录失败" });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`服务运行: http://localhost:${process.env.PORT} `);
});
