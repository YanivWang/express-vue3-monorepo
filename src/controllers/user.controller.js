import bcrypt from "bcrypt";
import { User } from "../db.js";

export function getUsers(req, res) {
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
}

export async function getUserById(req, res) {
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
}

export async function getOneUser(req, res) {
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
}

export async function deleteUser(req, res) {
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
}

export async function updateUser(req, res) {
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
}
