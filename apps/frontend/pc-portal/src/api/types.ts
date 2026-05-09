/** 与 docs/openapi.yaml 对齐的列表解包形态（已剔除 code/msg） */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface PostAuthor {
  id: number;
  username: string;
  avatar?: string | null;
}

export interface PostCategory {
  id: number;
  name: string;
}

export interface PostItem {
  id: number;
  title: string;
  content: string;
  published: boolean;
  authorId: number;
  categoryId: number;
  images?: string[];
  createdAt: string;
  updatedAt: string;
  author?: PostAuthor;
  category?: PostCategory;
}

export interface CategoryTreeNode {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
  children?: CategoryTreeNode[];
}

export interface CommentReplyItem {
  id: number;
  postId: number;
  authorId: number;
  parentId: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: PostAuthor;
}

export interface CommentThreadItem extends CommentReplyItem {
  replies?: CommentReplyItem[];
}

export interface PostsListResult {
  posts: PostItem[];
  pagination: Pagination;
}

export interface CategoriesListResult {
  categories: CategoryTreeNode[];
}

export interface PostOneResult {
  post: PostItem;
}

export interface CommentsListResult {
  comments: CommentThreadItem[];
  pagination: Pagination;
}

export interface ListPostsQuery {
  page?: number;
  limit?: number;
  parentId?: number;
  categoryId?: number;
}
