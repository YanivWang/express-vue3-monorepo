import { z } from "zod";

//schema 是用来校验请求参数的，使用 zod 库
const credentialsBodySchema = z.object({
  username: z.string({ error: "用户名不能为空" }).trim().min(1, "用户名不能为空").max(100, "用户名最多 100 个字符"),
  password: z.string({ error: "密码不能为空" }).trim().min(1, "密码不能为空").max(100, "密码最多 100 个字符"),
});

export const registerSchema = z.object({
  body: credentialsBodySchema,
});

export const loginSchema = z.object({
  body: credentialsBodySchema,
});
