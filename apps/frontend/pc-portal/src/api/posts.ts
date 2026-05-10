import { http } from "./http";
import { toPostsListParams } from "./query";

import type { ListPostsQuery, PostItem, PostOneResult, PostsListResult } from "./types";

export function fetchPostsList(q: ListPostsQuery) {
  return http.get<PostsListResult>("/api/posts", toPostsListParams(q));
}

export function fetchMyPostsList(q: ListPostsQuery) {
  return http.get<PostsListResult>("/api/posts/mine/list", toPostsListParams(q));
}

export function fetchPostById(id: number) {
  return http.get<PostOneResult>(`/api/posts/${id}`);
}

export interface CreatePostBody {
  title: string;
  content: string;
  categoryId: number;
  published?: boolean;
  images?: string[];
}

export function createPost(body: CreatePostBody) {
  return http.post<{ post: PostItem }>("/api/posts", body);
}

export type UpdatePostBody = Partial<CreatePostBody>;

export function updatePost(id: number, body: UpdatePostBody) {
  return http.put<{ post: PostItem }>(`/api/posts/${id}`, body);
}

export function deletePost(id: number) {
  return http.delete(`/api/posts/${id}`);
}

/**
 * 公开 GET 对未发布文章恒 404；仅在「详情不存在」类错误时回落到「我的文章」分页查找（草稿）。
 */
export async function fetchPostForEditor(id: number): Promise<PostItem> {
  try {
    const { post } = await fetchPostById(id);
    return post;
  } catch (e) {
    const err = e as { status?: number; code?: number };
    const notFound = err.status === 404 || err.code === 404;
    if (!notFound) throw e;
    let page = 1;
    const limit = 100;
    for (;;) {
      const { posts, pagination } = await fetchMyPostsList({ page, limit });
      const found = posts.find((p) => p.id === id);
      if (found) return found;
      if (!pagination.hasNext) {
        throw new Error("文章不存在或无权编辑");
      }
      page += 1;
    }
  }
}
