import { z } from "zod";

const idSchema = z
  .string({ error: "文章 ID 必须是正整数" })
  .trim()
  .regex(/^[1-9]\d*$/, "文章 ID 必须是正整数")
  .transform(Number);

const paginationNumberSchema = (defaultValue: number) =>
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

const optionalSearchQuery = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : v),
  z.string().trim().max(200, "搜索关键词过长").optional(),
);

const listPostsBaseFields = z.object({
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
});

const listPostsPaginationCategorySchema = listPostsBaseFields.refine(
  (q) => !(q.parentId != null && q.categoryId != null),
  {
    message: "parentId 与 categoryId 不能同时传递",
  },
);

const sortQuerySchema = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? "latest" : v),
  z.enum(["latest", "hot"]),
);

const listPostsQuerySchema = listPostsBaseFields
  .extend({
    q: optionalSearchQuery,
    sort: sortQuerySchema,
  })
  .strict()
  .refine((q) => !(q.parentId != null && q.categoryId != null), {
    message: "parentId 与 categoryId 不能同时传递",
  })
  .refine(
    (q) => {
      const term = q.q?.trim();
      if (!term) return true;
      return q.parentId == null && q.categoryId == null;
    },
    {
      message: "搜索关键词不能与 parentId/categoryId 同时使用",
      path: ["q"],
    },
  )
  .transform((q) => {
    const term = q.q?.trim();
    if (term && q.sort === "hot") {
      return { ...q, sort: "latest" as const };
    }
    return q;
  });

export const listPostsSchema = z.object({
  query: listPostsQuerySchema,
});

export const getPostSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
});

const postBodySchema = z.object({
  title: z
    .string({ error: "标题不能为空" })
    .trim()
    .min(1, "标题不能为空")
    .max(200, "标题最多 200 个字符"),
  content: z.string({ error: "正文不能为空" }).trim().min(1, "正文不能为空"),
  published: z.coerce.boolean().optional(),
});

const createPostBodySchema = postBodySchema
  .extend({
    categoryId: z.coerce
      .number({ error: "分类 ID 须为正整数" })
      .int("分类 ID 须为正整数")
      .positive("分类 ID 须为正整数"),
    externalSource: z.string().trim().max(64, "externalSource 过长").optional(),
    externalKey: z.string().trim().max(128, "externalKey 过长").optional(),
  })
  .superRefine((body, ctx) => {
    const hasSrc = body.externalSource != null && body.externalSource !== "";
    const hasKey = body.externalKey != null && body.externalKey !== "";
    if (hasSrc !== hasKey) {
      ctx.addIssue({
        code: "custom",
        message: "externalSource 与 externalKey 须同时提供或同时省略",
        path: ["externalSource"],
      });
    }
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

export const listFavoritesSchema = z.object({
  query: z.object({
    page: paginationNumberSchema(1),
    limit: paginationLimitSchema,
  }),
});

export const votePostSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
  body: z.object({
    vote: z.enum(["like", "dislike", "none"]),
  }),
});

export const favoritePostSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
  body: z.object({
    favorited: z.coerce.boolean(),
  }),
});

export const listMyPostsSchema = z.object({
  query: listPostsPaginationCategorySchema,
});

export type ValidatedListPostsSchema = z.infer<typeof listPostsSchema>;
export type ValidatedListFavoritesSchema = z.infer<typeof listFavoritesSchema>;
export type ValidatedVotePostSchema = z.infer<typeof votePostSchema>;
export type ValidatedFavoritePostSchema = z.infer<typeof favoritePostSchema>;
export type ValidatedGetPostSchema = z.infer<typeof getPostSchema>;
export type ValidatedCreatePostSchema = z.infer<typeof createPostSchema>;
export type ValidatedUpdatePostSchema = z.infer<typeof updatePostSchema>;
export type ValidatedDeletePostSchema = z.infer<typeof deletePostSchema>;
export type ValidatedListMyPostsSchema = z.infer<typeof listMyPostsSchema>;
