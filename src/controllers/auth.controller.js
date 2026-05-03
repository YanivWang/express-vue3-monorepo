import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UniqueConstraintError } from "sequelize";
import { JWT_SECRET } from "../env.js";
import { User } from "../db.js";

//controller 负责处理业务逻辑

//注册功能方法实现
export async function register(req, res) {
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
}

//登录功能方法实现
export async function login(req, res) {
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
}
