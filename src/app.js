// 主文件: 启动服务 + 写接口

import { JWT_SECRET, PORT } from "./env.js";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
// es 模块中导入本地文件时，必须包含完整的文件扩展名，node.js 不会自动解析 .js .json 等扩展名
import { User } from "./db.js";
import { UniqueConstraintError } from "sequelize";

import { setupSwagger } from "./swagger.js";

//创建服务
const app = express();

//使用中间件=====
//cors 解决跨域问题
app.use(cors());
//express.json() 解析请求体中的json数据
app.use(express.json());

// Swagger UI：/api-docs ；契约文件：docs/openapi.yaml ，运行时可 GET /openapi.yaml 给 Apifox 导入
setupSwagger(app);

// 业务接口 ======================================

//异步路由需要加 try,catch 处理错误, 否则一旦出错会变成 未处理的 Promise 拒绝
//客户端可能一直等不到响应或进程日志里报错
app.post("/api/register", async (req, res) => {
  try {
    let { username, password } = req.body;

    //和 || 的差别：|| 会把所有「假值」换成默认值（""、0、false 都会触发）；
    // ?? 只在 null / undefined 时换，更适合「缺字段时用默认字符串」这种场景，
    // 避免把合法的 0 或空字符串误当成「没传」
    username = String(username ?? "").trim();
    password = String(password ?? "").trim();

    //入参校验（请求入参必须校验，防止非法数据进入数据库）
    if (!username || !password) {
      return res.status(400).json({ code: 400, msg: "用户名或密码不能为空" });
    }

    const hashPwd = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashPwd });

    res.json({ code: 200, msg: "注册成功" });
  } catch (error) {
    //精准识别错误，并提出友好提示
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({ code: 409, msg: "用户名已存在" });
    }
    console.error(error); //打印服务端日志，帮助排查错误
    res.status(500).json({ code: 500, msg: "注册失败" });
  }
});

//异步路由(包含async 和 await)需要加try catch
app.post("/api/login", async (req, res) => {
  try {
    let { username, password } = req.body; //从请求体中拿参数
    username = String(username ?? "").trim();
    password = String(password ?? "").trim();

    //入参校验（请求入参必须校验，防止非法数据进入数据库）
    if (!username || !password) {
      return res.status(400).json({ code: 400, msg: "用户名或密码不能为空" });
    }

    const user = await User.findOne({ where: { username } });
    let credentialOk = false;
    if (user) {
      credentialOk = await bcrypt.compare(password, user.password);
    }
    // 统一文案，避免区分「用户不存在 / 密码错误」导致用户名枚举
    if (!credentialOk) {
      return res.status(401).json({ code: 401, msg: "用户名或密码错误" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({ code: 200, msg: "登录成功", token });
  } catch (error) {
    console.error(error); //打印服务端日志，帮助排查错误
    res.status(500).json({ code: 500, msg: "登录失败" });
  }
});

//查询所有用户列表
//这些带 async 的才是「异步路由（async/await）」；你这段是同步签名的 handler + 内部异步 Promise，
// try/catch 只能兜住同步抛错，兜不住 findAll() 在 Promise 里 reject 的情况（所以错误要靠
// .catch 处理，你代码里已经写了）。若改//成 async + await + try/catch，就和上面注册/登录风格一致了。
app.get("/api/users", (req, res) => {
  try {
    //触发一个同步错误
    //throw new Error("这是一个同步错误");

    User.findAll()
      .then((users) => {
        res.json({ code: 200, msg: "获取用户列表成功", users });
      })
      .catch((error) => {
        console.error(error); //打印服务端日志，帮助排查错误
        res.status(500).json({ code: 500, msg: "获取用户列表失败" });
      });
  } catch (error) {
    //try catch 只能捕获同步错误，不能捕获异步错误， User.findAll()返回的是一个Promise，如果这个Promise被拒绝
    //则只会走  User.findAll() 自带的catch块，而不是走 try 的 catch块
    console.error(error); //打印服务端日志，帮助排查错误
    res.status(500).json({ code: 500, msg: "获取用户列表失败" });
  }
});

//查询单个用户(从接口路径中拿id)
app.get("/api/users/:id", async (req, res) => {
  try {
    console.log("req.params11111111111BBBBBBB>>>>", req.params); //拿路径参数
    const { id } = req.params; // 拿路径参数
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ code: 404, msg: "用户不存在" });
    }
    res.json({ code: 200, msg: "获取用户成功", user });
  } catch (error) {
    console.error(error); //打印服务端日志，帮助排查错误
    res.status(500).json({ code: 500, msg: "获取用户失败" });
  }
});

//查询单个用户(从地址栏查询参数中取id)
app.get("/api/getOneUser", async (req, res) => {
  try {
    console.log("req.query>>>>", req.query); //拿查询参数
    const { id } = req.query; // 接口路径参数
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ code: 404, msg: "用户不存在" });
    }
    res.json({ code: 200, msg: "获取用户成功", user });
  } catch (error) {
    console.error(error); //打印服务端日志，帮助排查错误
    res.status(500).json({ code: 500, msg: "获取用户失败" });
  }
});

//删除单个用户
app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params; // 接口路径参数
    //按主键查找用户
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ code: 404, msg: "用户不存在" });
    }
    //删除数据库里这一行
    await user.destroy();
    res.json({ code: 200, msg: "删除用户成功" });
  } catch (error) {
    console.error(error); //打印服务端日志，帮助排查错误
    res.status(500).json({ code: 500, msg: "删除用户失败" });
  }
});

//修改用户信息
app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params; // 接口路径参数
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ code: 404, msg: "用户不存在" });
    }

    const { username, password } = req.body; //从请求体中拿username和password
    if (!username || !password) {
      return res.status(400).json({ code: 400, msg: "用户名或密码不能为空" });
    }
    const hashPwd = await bcrypt.hash(password, 10);
    await user.update({ username, password: hashPwd });
    res.json({ code: 200, msg: "更新用户成功" });
  } catch (error) {
    console.error(error); //打印服务端日志，帮助排查错误
    res.status(500).json({ code: 500, msg: "更新用户失败" });
  }
});

// 启动服务
app.listen(PORT, () => {
  console.log(`服务运行: http://localhost:${PORT} `);
});
