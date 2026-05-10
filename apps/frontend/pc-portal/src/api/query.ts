import type { ListPostsQuery } from "./types";

/**
 * 「我的文章」列表：仅分页与类目，忽略搜索字段，避免误入 GET 查询串。
 */
export function toMinePostsListParams(
  q: Pick<ListPostsQuery, "page" | "limit" | "parentId" | "categoryId">,
): Record<string, number | string> {
  const page = q.page ?? 1;
  const limit = q.limit ?? 10;
  const params: Record<string, number | string> = { page, limit };
  if (q.categoryId != null) {
    params.categoryId = q.categoryId;
    return params;
  }
  if (q.parentId != null) {
    params.parentId = q.parentId;
  }
  return params;
}

/** parentId（一级）与 categoryId（叶子）互斥；关键字 q / keyword 与分类参数互斥，由服务端校验。 */
export function toPostsListParams(q: ListPostsQuery): Record<string, number | string> {
  const page = q.page ?? 1;
  const limit = q.limit ?? 10;
  const term = typeof q.q === "string" ? q.q.trim() : "";
  const termAlt = typeof q.keyword === "string" ? q.keyword.trim() : "";
  const search = term || termAlt;

  const params: Record<string, number | string> = { page, limit };
  if (search) {
    params.q = search;
    return params;
  }
  if (q.categoryId != null) {
    params.categoryId = q.categoryId;
    return params;
  }
  if (q.parentId != null) {
    params.parentId = q.parentId;
  }
  return params;
}
