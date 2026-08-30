import type {
  CommentReplyItem,
  CommentThreadItem,
  CommentsListResult,
  PostItem,
  PostsListResult,
} from "@/api/types";

/** 造数工厂：默认值代表「最常见的一篇正常文章」，用例只覆盖它关心的那几个字段 */

export function makePost(overrides: Partial<PostItem> = {}): PostItem {
  return {
    id: 1,
    title: "码笺的第一篇文章",
    content: "<p>正文段落</p>",
    published: true,
    authorId: 7,
    categoryId: 3,
    createdAt: "2026-01-02T03:04:05.000Z",
    updatedAt: "2026-01-02T03:04:05.000Z",
    commentCount: 2,
    favoriteCount: 5,
    likeCount: 9,
    dislikeCount: 0,
    viewCount: 123,
    myVote: null,
    myFavorited: false,
    author: { id: 7, username: "author-one", avatar: null },
    category: { id: 3, name: "前端工程" },
    ...overrides,
  };
}

export function makeReply(overrides: Partial<CommentReplyItem> = {}): CommentReplyItem {
  return {
    id: 200,
    postId: 1,
    authorId: 8,
    parentId: 100,
    rootId: 100,
    content: "楼内回复内容",
    createdAt: "2026-01-03T05:00:00.000Z",
    updatedAt: "2026-01-03T05:00:00.000Z",
    author: { id: 8, username: "replier", avatar: null },
    replyToUser: null,
    ...overrides,
  };
}

export function makeComment(overrides: Partial<CommentThreadItem> = {}): CommentThreadItem {
  return {
    id: 100,
    postId: 1,
    authorId: 9,
    parentId: null,
    rootId: 100,
    content: "主评内容",
    createdAt: "2026-01-03T04:00:00.000Z",
    updatedAt: "2026-01-03T04:00:00.000Z",
    author: { id: 9, username: "commenter", avatar: null },
    replyToUser: null,
    replies: [],
    ...overrides,
  };
}

export function makeCommentsResult(
  comments: CommentThreadItem[],
  overrides: Partial<CommentsListResult["pagination"]> = {},
): CommentsListResult {
  return {
    comments,
    pagination: {
      page: 1,
      limit: 20,
      total: comments.length,
      totalPages: 1,
      hasNext: false,
      commentTotal: comments.reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0),
      ...overrides,
    },
  };
}

export function makePostsResult(
  posts: PostItem[],
  overrides: Partial<PostsListResult["pagination"]> = {},
): PostsListResult {
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
