import { http } from "./http";

import type { CommentReplyItem, CommentsListResult } from "./types";

export function fetchComments(postId: number, page = 1, limit = 20) {
  return http.get<CommentsListResult>(`/api/posts/${postId}/comments`, { page, limit });
}

export function createComment(postId: number, body: { content: string; parentId?: number | null }) {
  return http.post<{ comment: CommentReplyItem }>(`/api/posts/${postId}/comments`, body);
}

export function deleteComment(postId: number, commentId: number) {
  return http.delete(`/api/posts/${postId}/comments/${commentId}`);
}
