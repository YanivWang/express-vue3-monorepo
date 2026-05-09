import { z } from "zod";

const idSchema = z
  .string({ error: "文章 ID 必须是正整数" })
  .trim()
  .regex(/^[1-9]\d*$/, "文章 ID 必须是正整数")
  .transform(Number);

const paginationNumberSchema = (defaultValue) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.coerce
      .number({ error: "分页参数必须是正整数" })
      .int("分页参数必须是正整数")
      .positive("分页参数必须是正整数"),
  );

const paginationLimitSchema = z.preprocess(
  (value) => (value === undefined ? 10 : value),
  z.coerce
    .number({ error: "分页参数必须是正整数" })
    .int("分页参数必须是正整数")
    .positive("分页参数必须是正整数")
    .max(100, "每页条数不能超过 100"),
);

const listPostsQuerySchema = z
  .object({
    page: paginationNumberSchema(1),
    limit: paginationLimitSchema,
    parentId: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : v),
      z
        .string()
        .trim()
        .regex(/^[1-9]\d*$/, "parentId 必须是正整数")
        .transform(Number)
        .optional(),
    ),
    categoryId: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : v),
      z
        .string()
        .trim()
        .regex(/^[1-9]\d*$/, "categoryId 必须是正整数")
        .transform(Number)
        .optional(),
    ),
  })
  .refine((q) => !(q.parentId != null && q.categoryId != null), {
    message: "parentId 与 categoryId 不能同时传递",
  });

export const listPostsSchema = z.object({
  query: listPostsQuerySchema,
});

export const getPostSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
});

const postImagePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^\/uploads\/[a-zA-Z0-9._/-]+$/, "图片须为本站 /uploads/ 路径");

const postImagesSchema = z.array(postImagePathSchema).max(24, "图片最多 24 张").optional();

const postBodySchema = z.object({
  title: z
    .string({ error: "标题不能为空" })
    .trim()
    .min(1, "标题不能为空")
    .max(200, "标题最多 200 个字符"),
  content: z.string({ error: "正文不能为空" }).trim().min(1, "正文不能为空"),
  published: z.coerce.boolean().optional(),
  images: postImagesSchema,
});

const createPostBodySchema = postBodySchema.extend({
  categoryId: z.coerce
    .number({ error: "分类 ID 须为正整数" })
    .int("分类 ID 须为正整数")
    .positive("分类 ID 须为正整数"),
});

export const createPostSchema = z.object({
  body: createPostBodySchema,
});

export const updatePostSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
  body: postBodySchema.partial().extend({
    categoryId: z.coerce
      .number({ error: "分类 ID 须为正整数" })
      .int("分类 ID 须为正整数")
      .positive("分类 ID 须为正整数")
      .optional(),
  }),
});

export const deletePostSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
});

/** 可选：我的文章列表 */
export const listMyPostsSchema = z.object({
  query: listPostsQuerySchema,
});
