export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface CurrentUserProfile {
  id: number;
  username: string;
  avatar: string | null;
  /** GET /api/me 必有；部分管理端列表可能不返回 */
  nickname?: string | null;
  roleId?: number;
  roleSlug?: string;
  permissions?: string[];
}

export interface CategoryTreeNode {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
  children?: CategoryTreeNode[];
}

export interface PostItem {
  id: number;
  title: string;
  content: string;
  published: boolean;
  authorId: number;
  categoryId: number;
  images?: string[];
}

export interface PostAuthor {
  id: number;
  username: string;
  avatar?: string | null;
}

export interface PostsListWrap {
  posts: PostItem[];
  pagination: Pagination;
}
