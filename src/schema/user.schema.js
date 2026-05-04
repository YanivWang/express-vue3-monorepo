import { z } from "zod";

const idSchema = z
  .string({ error: "用户 ID 必须是正整数" })
  .trim()
  .regex(/^[1-9]\d*$/, "用户 ID 必须是正整数")
  .transform(Number);

const paginationNumberSchema = (defaultValue) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.coerce.number({ error: "分页参数必须是正整数" }).int("分页参数必须是正整数").positive("分页参数必须是正整数")
  );

const userBodySchema = z.object({
  username: z.string({ error: "用户名不能为空" }).trim().min(1, "用户名不能为空").max(100, "用户名最多 100 个字符"),
  password: z.string({ error: "密码不能为空" }).trim().min(1, "密码不能为空").max(100, "密码最多 100 个字符"),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
  body: userBodySchema,
});

export const deleteUserSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
});

export const getUserSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
});

export const getOneUserSchema = z.object({
  query: z.object({
    id: idSchema,
  }),
});

export const getUsersSchema = z.object({
  query: z.object({
    page: paginationNumberSchema(1),
    limit: paginationNumberSchema(10),
  }),
});
