import { z } from "zod";

const idSchema = z
  .string({ error: "文章 ID 必须是正整数" })
  .trim()
  .regex(/^[1-9]\d*$/, "文章 ID 必须是正整数")
  .transform(Number);

const paginationNumberSchema = (defaultValue) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.coerce.number({ error: "分页参数必须是正整数" }).int("分页参数必须是正整数").positive("分页参数必须是正整数"),
  );

const paginationLimitSchema = z.preprocess(
  (value) => (value === undefined ? 10 : value),
  z.coerce.number({ error: "分页参数必须是正整数" }).int("分页参数必须是正整数").positive("分页参数必须是正整数").max(100, "每页条数不能超过 100"),
);

export const listPostsSchema = z.object({
  query: z.object({
    page: paginationNumberSchema(1),
    limit: paginationLimitSchema,
    // 可选：mine=1 时仅登录用户看自己的文（若你在 controller 里实现）
    // mine: z.coerce.boolean().optional(),
  }),
});

export const getPostSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
});

const postBodySchema = z.object({
  title: z.string({ error: "标题不能为空" }).trim().min(1, "标题不能为空").max(200, "标题最多 200 个字符"),
  content: z.string({ error: "正文不能为空" }).trim().min(1, "正文不能为空"),
  published: z.coerce.boolean().optional(),
});

export const createPostSchema = z.object({
  body: postBodySchema,
});

export const updatePostSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
  body: postBodySchema.partial(),
});

export const deletePostSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
});

/** 可选：我的文章列表 */
export const listMyPostsSchema = z.object({
  query: z.object({
    page: paginationNumberSchema(1),
    limit: paginationLimitSchema,
  }),
});
