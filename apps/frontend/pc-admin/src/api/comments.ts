import { http } from "./http";

import type { Pagination } from "./types";

export interface AdminCommentRow {
  id: number;
  postId: number;
  authorId: number;
  parentId: number | null;
  rootId: number | null;
  content: string;
  postTitle?: string | null;
  contentExcerpt?: string;
}

export function fetchAdminComments(q: Record<string, unknown>) {
  return http.get<{ comments: AdminCommentRow[]; pagination: Pagination }>(
    "/api/admin/comments",
    q,
  );
}

export function deleteComment(postId: number, commentId: number) {
  return http.delete(`/api/posts/${postId}/comments/${commentId}`);
}
