import { loginUser, registerUser } from "../services/auth.service.js";
import { getValidated } from "../utils/getValidated.js";
import { success } from "../utils/response.js";

import type { ValidatedLoginSchema, ValidatedRegisterSchema } from "../schema/auth.schema.js";
import type { Request, Response } from "express";

export async function register(req: Request, res: Response) {
  const { body } = getValidated<ValidatedRegisterSchema>(req);
  await registerUser(body);
  return success(res, "注册成功");
}

export async function login(req: Request, res: Response) {
  const { body } = getValidated<ValidatedLoginSchema>(req);
  const token = await loginUser(body);
  return success(res, "登录成功", { token });
}
