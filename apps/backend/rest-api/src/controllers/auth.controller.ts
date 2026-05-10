import { loginUser, registerUser } from "../services/auth.service.js";
import { success } from "../utils/response.js";

import type { Request, Response } from "express";

export async function register(req: Request, res: Response) {
  await registerUser(req.body as { username?: unknown; password?: unknown });
  return success(res, "注册成功");
}

export async function login(req: Request, res: Response) {
  const token = await loginUser(req.body as { username?: unknown; password?: unknown });
  return success(res, "登录成功", { token });
}
