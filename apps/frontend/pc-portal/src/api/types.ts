/** 与 docs/openapi.yaml 对齐的列表解包形态（已剔除 code/msg） */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

/** GET /api/posts/:postId/comments 的分页：total 为主评条数，commentTotal 为该文下评论总条数 */
export interface CommentsPagination extends Pagination {
  commentTotal: number;
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
  commentCount?: number;
  favoriteCount?: number;
  likeCount?: number;
  dislikeCount?: number;
  viewCount?: number;
  /** 登录且请求带 Token 时出现 */
  myVote?: "like" | "dislike" | null;
  /** 登录且请求带 Token 时出现 */
  myFavorited?: boolean;
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
  /** 楼主评 id；顶层评论与自身 id 相同 */
  rootId: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: PostAuthor;
  /** 被直接回复的评论作者（用于 A ▸ B）；顶层主评行通常无此字段 */
  replyToUser?: PostAuthor | null;
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
  pagination: CommentsPagination;
}

/** 与 GET /api/me 返回的 `user` 对齐（服务端为准，不含密码） */
export interface CurrentUserProfile {
  id: number;
  username: string;
  avatar: string | null;
  role: number;
  roleId?: number;
  roleSlug?: string;
  /** RBAC 权限码列表；超级管理员为全部业务码 */
  permissions?: string[];
}

export interface CurrentUserResult {
  user: CurrentUserProfile;
}

export interface ListPostsQuery {
  page?: number;
  limit?: number;
  parentId?: number;
  categoryId?: number;
  /** latest=按时间 hot=评论+收藏+赞 综合热度 */
  sort?: "latest" | "hot";
  /** 全站公开文章关键字（与服务端 GET /api/posts 的 q 对齐；不能与 parentId/categoryId 同时传） */
  q?: string;
  keyword?: string;
}
