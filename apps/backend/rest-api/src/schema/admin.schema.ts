import { z } from "zod";

const idParam = z.object({
  id: z
    .string({ error: "ID 必须是正整数" })
    .trim()
    .regex(/^[1-9]\d*$/, "ID 必须是正整数")
    .transform(Number),
});

export const paginationNumberSchema = (defaultValue: number) =>
  z.preprocess(
    (value) => (value === undefined ? defaultValue : value),
    z.coerce
      .number({ error: "分页参数必须是正整数" })
      .int("分页参数必须是正整数")
      .positive("分页参数必须是正整数"),
  );

export const paginationLimitSchema = z.preprocess(
  (value) => (value === undefined ? 10 : value),
  z.coerce
    .number({ error: "分页参数必须是正整数" })
    .int("分页参数必须是正整数")
    .positive("分页参数必须是正整数")
    .max(100, "每页条数不能超过 100"),
);

const optionalBoolQuery = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return undefined;
  if (v === "true" || v === true) return true;
  if (v === "false" || v === false) return false;
  return v;
}, z.boolean().optional());

const optionalSearchQuery = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : v),
  z.string().trim().max(200).optional(),
);

const optionalIdQuery = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : v),
  z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .optional(),
);

export const adminListPostsSchema = z.object({
  query: z
    .object({
      page: paginationNumberSchema(1),
      limit: paginationLimitSchema,
      published: optionalBoolQuery,
      authorId: optionalIdQuery,
      categoryId: optionalIdQuery,
      parentId: optionalIdQuery,
      q: optionalSearchQuery,
    })
    .refine((q) => !(q.parentId != null && q.categoryId != null), {
      message: "parentId 与 categoryId 不能同时传递",
    }),
});

export const adminGetPostSchema = z.object({
  params: idParam,
});

export const adminCreateCategoryRootSchema = z.object({
  body: z.object({
    name: z.string({ error: "名称不能为空" }).trim().min(1).max(100),
    sortOrder: z.coerce.number().int().optional(),
  }),
});

export const adminCreateCategoryLeafSchema = z.object({
  body: z.object({
    parentId: z.coerce.number().int().positive(),
    name: z.string({ error: "名称不能为空" }).trim().min(1).max(100),
    sortOrder: z.coerce.number().int(),
  }),
});

export const adminPatchCategorySchema = z.object({
  params: idParam,
  body: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      sortOrder: z.coerce.number().int().optional(),
    })
    .refine((b) => b.name !== undefined || b.sortOrder !== undefined, {
      message: "至少提供 name 或 sortOrder",
    }),
});

export const adminDeleteCategorySchema = z.object({
  params: idParam,
});

export const adminPortalUsersListSchema = z.object({
  query: z.object({
    page: paginationNumberSchema(1),
    limit: paginationLimitSchema,
    q: optionalSearchQuery,
  }),
});

export const adminPortalUserPatchSchema = z.object({
  params: idParam,
  body: z
    .object({
      username: z.string().trim().min(1).max(100).optional(),
      avatar: z.string().trim().max(500).nullable().optional(),
    })
    .refine((b) => b.username !== undefined || b.avatar !== undefined, {
      message: "至少提供 username 或 avatar",
    }),
});

export const adminPortalUserDeleteSchema = z.object({
  params: idParam,
});

export const adminStaffListSchema = z.object({
  query: z.object({
    page: paginationNumberSchema(1),
    limit: paginationLimitSchema,
    q: optionalSearchQuery,
  }),
});

export const adminStaffCreateSchema = z.object({
  body: z.object({
    username: z.string().trim().min(1).max(100),
    password: z.string().trim().min(1).max(100),
    roleId: z.coerce.number().int().positive(),
  }),
});

export const adminStaffPatchSchema = z.object({
  params: idParam,
  body: z
    .object({
      username: z.string().trim().min(1).max(100).optional(),
      avatar: z.string().trim().max(500).nullable().optional(),
      password: z.string().trim().min(1).max(100).optional(),
      roleId: z.coerce.number().int().positive().optional(),
    })
    .refine(
      (b) =>
        b.username !== undefined ||
        b.avatar !== undefined ||
        b.password !== undefined ||
        b.roleId !== undefined,
      { message: "至少提供一个可更新字段" },
    ),
});

export const adminStaffDeleteSchema = z.object({
  params: idParam,
});

export const adminRolesCreateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(64),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9_-]+$/, "slug 仅允许小写字母、数字、下划线与连字符"),
    isStaff: z.coerce.boolean().optional(),
  }),
});

export const adminRolesPatchSchema = z.object({
  params: idParam,
  body: z
    .object({
      name: z.string().trim().min(1).max(64).optional(),
      isStaff: z.coerce.boolean().optional(),
      permissionCodes: z.array(z.string()).optional(),
    })
    .refine(
      (b) => b.name !== undefined || b.isStaff !== undefined || b.permissionCodes !== undefined,
      {
        message: "至少提供一个可更新字段",
      },
    ),
});

export const adminRolesDeleteSchema = z.object({
  params: idParam,
});

export const adminCommentsListSchema = z.object({
  query: z.object({
    page: paginationNumberSchema(1),
    limit: paginationLimitSchema,
    postId: optionalIdQuery,
    authorId: optionalIdQuery,
    q: optionalSearchQuery,
  }),
});

export type ValidatedAdminListPostsSchema = z.infer<typeof adminListPostsSchema>;
export type ValidatedAdminGetPostSchema = z.infer<typeof adminGetPostSchema>;
export type ValidatedAdminCreateCategoryRootSchema = z.infer<typeof adminCreateCategoryRootSchema>;
export type ValidatedAdminCreateCategoryLeafSchema = z.infer<typeof adminCreateCategoryLeafSchema>;
export type ValidatedAdminPatchCategorySchema = z.infer<typeof adminPatchCategorySchema>;
export type ValidatedAdminDeleteCategorySchema = z.infer<typeof adminDeleteCategorySchema>;
export type ValidatedAdminPortalUsersListSchema = z.infer<typeof adminPortalUsersListSchema>;
export type ValidatedAdminPortalUserPatchSchema = z.infer<typeof adminPortalUserPatchSchema>;
export type ValidatedAdminPortalUserDeleteSchema = z.infer<typeof adminPortalUserDeleteSchema>;
export type ValidatedAdminStaffListSchema = z.infer<typeof adminStaffListSchema>;
export type ValidatedAdminStaffCreateSchema = z.infer<typeof adminStaffCreateSchema>;
export type ValidatedAdminStaffPatchSchema = z.infer<typeof adminStaffPatchSchema>;
export type ValidatedAdminStaffDeleteSchema = z.infer<typeof adminStaffDeleteSchema>;
export type ValidatedAdminRolesCreateSchema = z.infer<typeof adminRolesCreateSchema>;
export type ValidatedAdminRolesPatchSchema = z.infer<typeof adminRolesPatchSchema>;
export type ValidatedAdminRolesDeleteSchema = z.infer<typeof adminRolesDeleteSchema>;
export type ValidatedAdminCommentsListSchema = z.infer<typeof adminCommentsListSchema>;
