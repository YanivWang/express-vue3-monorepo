import { z } from "zod";

export const createCategorySchema = z.object({
  body: z.object({
    parentId: z.coerce
      .number({ error: "parentId 须为正整数" })
      .int("parentId 须为正整数")
      .positive("parentId 须为正整数"),
    name: z
      .string({ error: "分类名称不能为空" })
      .trim()
      .min(1, "分类名称不能为空")
      .max(80, "分类名称最多 80 个字符"),
    sortOrder: z.coerce.number({ error: "sortOrder 须为整数" }).int().optional().default(0),
  }),
});

export type ValidatedCreateCategorySchema = z.infer<typeof createCategorySchema>;
