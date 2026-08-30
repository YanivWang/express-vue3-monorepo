import type { CategoryTreeNode, PostItem, PostsListWrap } from "@/api/types";

/**
 * 管理端造数工厂。
 *
 * 列表接口实际会带回 author / category 两个关联对象，用交叉类型显式表达，
 * 避免用例里出现 as any。
 */
export type AdminPostRow = PostItem & {
  author?: { id: number; username: string };
  category?: { id: number; name: string };
};

export function makeAdminPost(overrides: Partial<AdminPostRow> = {}): AdminPostRow {
  return {
    id: 1,
    title: "管理端第一篇",
    content: "<p>正文</p>",
    published: true,
    authorId: 7,
    categoryId: 3,
    author: { id: 7, username: "author-one" },
    category: { id: 3, name: "前端工程" },
    ...overrides,
  };
}

export function makeAdminPostsResult(
  posts: AdminPostRow[],
  overrides: Partial<PostsListWrap["pagination"]> = {},
): PostsListWrap {
  return {
    posts,
    pagination: {
      page: 1,
      limit: 10,
      total: posts.length,
      totalPages: 1,
      hasNext: false,
      ...overrides,
    },
  };
}

export const CATEGORY_TREE: CategoryTreeNode[] = [
  {
    id: 1,
    name: "技术",
    parentId: null,
    sortOrder: 1,
    children: [
      { id: 3, name: "前端工程", parentId: 1, sortOrder: 1 },
      { id: 4, name: "后端服务", parentId: 1, sortOrder: 2 },
    ],
  },
  {
    id: 2,
    name: "生活",
    parentId: null,
    sortOrder: 2,
    children: [{ id: 5, name: "随笔", parentId: 2, sortOrder: 1 }],
  },
];
