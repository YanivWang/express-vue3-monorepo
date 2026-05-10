import { http } from "./http";

import type { PostItem, PostsListWrap } from "./types";

export function fetchAdminPostsList(query: Record<string, unknown>) {
  return http.get<PostsListWrap>("/api/admin/posts", query);
}

export function fetchAdminPost(id: number) {
  return http.get<{ post: PostItem }>(`/api/admin/posts/${id}`);
}

export function updatePost(
  id: number,
  body: Partial<{
    title: string;
    content: string;
    categoryId: number;
    published: boolean;
    images: string[];
  }>,
) {
  return http.put<{ post: PostItem }>(`/api/posts/${id}`, body);
}

export function deletePost(id: number) {
  return http.delete(`/api/posts/${id}`);
}

export function createPost(body: {
  title: string;
  content: string;
  categoryId: number;
  published?: boolean;
  images?: string[];
}) {
  return http.post<{ post: PostItem }>("/api/posts", body);
}
