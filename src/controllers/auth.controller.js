import { loginUser, registerUser } from "../services/auth.service.js";
import { success } from "../utils/response.js";

//controller 负责处理请求和响应（调用 service 层完成任务）
//注册功能方法实现
export async function register(req, res) {
  await registerUser(req.body);
  return success(res, "注册成功");
}

//登录功能方法实现
export async function login(req, res) {
  const token = await loginUser(req.body);
  return success(res, "登录成功", { token });
}
