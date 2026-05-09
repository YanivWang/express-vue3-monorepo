import type { ListPostsQuery } from "./types";

/** parentId（一级）与 categoryId（叶子）互斥：同时只传其一。 */
export function toPostsListParams(q: ListPostsQuery): Record<string, number> {
  const page = q.page ?? 1;
  const limit = q.limit ?? 10;
  const params: Record<string, number> = { page, limit };
  if (q.categoryId != null) {
    params.categoryId = q.categoryId;
    return params;
  }
  if (q.parentId != null) {
    params.parentId = q.parentId;
  }
  return params;
}
