import { z } from "zod";

const postIdSchema = z
  .string({ error: "文章 ID 必须是正整数" })
  .trim()
  .regex(/^[1-9]\d*$/, "文章 ID 必须是正整数")
  .transform(Number);

const commentIdSchema = z
  .string({ error: "评论 ID 必须是正整数" })
  .trim()
  .regex(/^[1-9]\d*$/, "评论 ID 必须是正整数")
  .transform(Number);

const paginationNumberSchema = (defaultValue) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.coerce.number({ error: "分页参数必须是正整数" }).int("分页参数必须是正整数").positive("分页参数必须是正整数"),
  );

const paginationLimitSchema = z.preprocess(
  (value) => (value === undefined ? 20 : value),
  z.coerce.number({ error: "分页参数必须是正整数" }).int("分页参数必须是正整数").positive("分页参数必须是正整数").max(100, "每页条数不能超过 100"),
);

export const listCommentsSchema = z.object({
  params: z.object({
    postId: postIdSchema,
  }),
  query: z.object({
    page: paginationNumberSchema(1),
    limit: paginationLimitSchema,
  }),
});

export const createCommentSchema = z.object({
  params: z.object({
    postId: postIdSchema,
  }),
  body: z.object({
    content: z.string({ error: "评论内容不能为空" }).trim().min(1, "评论内容不能为空").max(5000, "评论内容过长"),
    parentId: z.preprocess(
      (val) => (val === null || val === "" ? undefined : val),
      z.coerce.number({ error: "parentId 必须是正整数" }).int("parentId 必须是正整数").positive("parentId 必须是正整数").optional(),
    ),
  }),
});

export const deleteCommentSchema = z.object({
  params: z.object({
    postId: postIdSchema,
    commentId: commentIdSchema,
  }),
});
