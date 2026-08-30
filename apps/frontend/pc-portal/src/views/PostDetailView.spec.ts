import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ESLint 的类型程序解析不了 .vue SFC 的具体类型（只有 vue-tsc 能），与 main.ts 一致显式标注

import * as commentsApi from "@/api/comments";
import * as postsApi from "@/api/posts";
import * as userApi from "@/api/user";
import { mountApp, profileFor, type TestUser } from "@/test/app-harness";
import { button, findContainingText, hasButton } from "@/test/dom";
import { confirmSpy, messageSpies, rejectNextConfirm } from "@/test/element-plus-services";
import {
  makeComment,
  makeCommentsResult,
  makePost,
  makePostsResult,
  makeReply,
} from "@/test/fixtures";

import PostDetailView from "./PostDetailView.vue";

import type { Component } from "vue";

/**
 * PostDetailView 的行为基线。
 *
 * 这批用例写在组件拆分之前，拆分之后必须一行不改地继续通过——
 * 它就是「重构没有改变行为」的证据。因此断言只认两样东西：
 * 用户在页面上看到/点到的东西，以及组件对外发出的请求。
 * 任何对内部 ref、方法名、组件层级的依赖都会让这份证据失效，所以一律不用。
 */

vi.mock("@/api/posts", () => ({
  fetchPostById: vi.fn(),
  fetchPostsList: vi.fn(),
  votePost: vi.fn(),
  setPostFavoriteHttp: vi.fn(),
  deletePost: vi.fn(),
}));

vi.mock("@/api/comments", () => ({
  fetchComments: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock("@/api/user", () => ({
  fetchCurrentUser: vi.fn(),
}));

const POST_ID = 1;
/** 文章作者本人 */
const AUTHOR: TestUser = { id: 7, username: "author-one" };
/** 与文章、评论都无关的普通登录用户 */
const READER: TestUser = { id: 42, username: "reader" };
/** 主评的作者 */
const COMMENTER: TestUser = { id: 9, username: "commenter" };

const EARLIER = makeComment({
  id: 100,
  authorId: 9,
  content: "较早的主评",
  createdAt: "2026-01-03T04:00:00.000Z",
  author: { id: 9, username: "commenter", avatar: null },
});

const LATER = makeComment({
  id: 101,
  authorId: 11,
  content: "较晚的主评",
  createdAt: "2026-01-03T06:00:00.000Z",
  author: { id: 11, username: "late-commenter", avatar: null },
  replies: [
    makeReply({
      id: 201,
      parentId: 101,
      rootId: 101,
      content: "楼内直接回复",
      author: { id: 8, username: "replier", avatar: null },
    }),
    makeReply({
      id: 202,
      // parentId 指向另一条回复而非楼主评：模板要渲染成「A ▸ B」的回复链
      parentId: 201,
      rootId: 101,
      content: "回复的回复",
      author: { id: 12, username: "deep-replier", avatar: null },
      replyToUser: { id: 8, username: "replier", avatar: null },
    }),
  ],
});

/** 当前登录者，供 fetchCurrentUser 的挡板回读（视图 onMounted 会再拉一次 profile） */
let signedIn: TestUser | null = null;

function recommendedPosts() {
  // 返回 8 条（含当前文章）使可推荐数 ≥ 6，避免触发第二次兜底请求
  return Array.from({ length: 8 }, (_, i) =>
    makePost({ id: i + 1, title: `推荐文章 ${i + 1}`, categoryId: 3 }),
  );
}

async function mountDetail(user?: TestUser) {
  signedIn = user ?? null;
  return mountApp(PostDetailView as Component, {
    path: `/posts/${POST_ID}`,
    routeName: "post-detail",
    user,
  });
}

beforeEach(() => {
  signedIn = null;
  vi.mocked(postsApi.fetchPostById).mockResolvedValue({ post: makePost() });
  vi.mocked(postsApi.fetchPostsList).mockResolvedValue(makePostsResult(recommendedPosts()));
  vi.mocked(postsApi.votePost).mockImplementation((_id, vote) =>
    Promise.resolve({ post: makePost({ myVote: vote === "none" ? null : vote }) }),
  );
  vi.mocked(postsApi.setPostFavoriteHttp).mockImplementation((_id, favorited) =>
    Promise.resolve({ post: makePost({ myFavorited: favorited }) }),
  );
  vi.mocked(postsApi.deletePost).mockResolvedValue(undefined);
  vi.mocked(commentsApi.fetchComments).mockResolvedValue(makeCommentsResult([EARLIER, LATER]));
  vi.mocked(commentsApi.createComment).mockResolvedValue({ comment: makeReply() });
  vi.mocked(commentsApi.deleteComment).mockResolvedValue(undefined);
  vi.mocked(userApi.fetchCurrentUser).mockImplementation(() =>
    signedIn
      ? Promise.resolve({ user: profileFor(signedIn) })
      : Promise.reject(new Error("未登录")),
  );
});

describe("PostDetailView / 文章主体渲染", () => {
  it("渲染标题、作者、分类与统计数字", async () => {
    const { wrapper } = await mountDetail();

    expect(wrapper.find(".title").text()).toBe("码笺的第一篇文章");
    expect(wrapper.find(".author-name").text()).toBe("author-one");
    expect(wrapper.find(".meta-line").text()).toContain("前端工程");
    // 正文 "<p>正文段落</p>" 去标签去空白后为 4 个字
    expect(wrapper.find(".meta-line").text()).toContain("字数 4");

    const engage = wrapper.find(".engage-row").text();
    expect(engage).toContain("阅读 123");
    expect(engage).toContain("评论 2");
    expect(engage).toContain("收藏 5");
    expect(engage).toContain("赞 9");
  });

  it("按 id 拉取文章，并把清洗后的正文交给编辑器渲染", async () => {
    const { wrapper } = await mountDetail();

    expect(postsApi.fetchPostById).toHaveBeenCalledWith(POST_ID);
    expect(wrapper.find(".post-body").html()).toContain("正文段落");
  });

  it("踩数为 0 时不显示「踩」这项统计", async () => {
    const { wrapper } = await mountDetail();
    expect(wrapper.find(".engage-row").text()).not.toContain("踩 ");
  });

  it("踩数大于 0 时显示该项统计", async () => {
    vi.mocked(postsApi.fetchPostById).mockResolvedValue({ post: makePost({ dislikeCount: 3 }) });
    const { wrapper } = await mountDetail();
    expect(wrapper.find(".engage-row").text()).toContain("踩 3");
  });
});

describe("PostDetailView / 推荐阅读", () => {
  it("渲染同分类推荐，并排除当前文章自身", async () => {
    const { wrapper } = await mountDetail();

    expect(postsApi.fetchPostsList).toHaveBeenCalledWith({ categoryId: 3, page: 1, limit: 14 });
    const links = wrapper.findAll(".rec-link");
    expect(links.length).toBeGreaterThan(0);
    expect(links.map((l) => l.text())).not.toContain("推荐文章 1");
  });

  it("点击推荐项跳转到对应文章详情", async () => {
    const { wrapper, router } = await mountDetail();

    await wrapper.findAll(".rec-link")[0].trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("post-detail");
    expect(router.currentRoute.value.params.id).toBe("2");
  });

  it("推荐接口失败时降级为「暂无推荐」而不是整页崩掉", async () => {
    vi.mocked(postsApi.fetchPostsList).mockRejectedValue(new Error("网络异常"));
    const { wrapper } = await mountDetail();

    expect(wrapper.find(".rec-empty").exists()).toBe(true);
    expect(wrapper.find(".title").text()).toBe("码笺的第一篇文章");
  });
});

describe("PostDetailView / 未登录访客", () => {
  it("看不到评论输入框，只看到登录提示", async () => {
    const { wrapper } = await mountDetail();

    expect(wrapper.find(".composer").exists()).toBe(false);
    expect(wrapper.find(".login-tip").text()).toBe("登录后可发表评论");
  });

  it("看不到任何回复与删除评论的入口", async () => {
    const { wrapper } = await mountDetail();

    expect(hasButton(wrapper, "回复")).toBe(false);
    expect(wrapper.find(".c-actions").text()).toBe("");
  });

  it("点赞会被拦下并跳转登录页，且不发起投票请求", async () => {
    const { wrapper, router } = await mountDetail();

    await button(wrapper, "点赞").trigger("click");
    await flushPromises();

    expect(postsApi.votePost).not.toHaveBeenCalled();
    expect(messageSpies.warning).toHaveBeenCalledWith("请先登录后再操作");
    expect(router.currentRoute.value.name).toBe("login");
    expect(router.currentRoute.value.query.redirect).toBe(`/posts/${POST_ID}`);
  });

  it("收藏同样会被拦下", async () => {
    const { wrapper, router } = await mountDetail();

    await button(wrapper, "收藏").trigger("click");
    await flushPromises();

    expect(postsApi.setPostFavoriteHttp).not.toHaveBeenCalled();
    expect(router.currentRoute.value.name).toBe("login");
  });
});

describe("PostDetailView / 互动操作", () => {
  it("点赞调用投票接口并切换为「已赞」", async () => {
    const { wrapper } = await mountDetail(READER);

    await button(wrapper, "点赞").trigger("click");
    await flushPromises();

    expect(postsApi.votePost).toHaveBeenCalledWith(POST_ID, "like");
    expect(hasButton(wrapper, "已赞")).toBe(true);
  });

  it("已赞状态下再次点击表示取消赞", async () => {
    vi.mocked(postsApi.fetchPostById).mockResolvedValue({ post: makePost({ myVote: "like" }) });
    const { wrapper } = await mountDetail(READER);

    await button(wrapper, "已赞").trigger("click");
    await flushPromises();

    expect(postsApi.votePost).toHaveBeenCalledWith(POST_ID, "none");
  });

  it("点踩在已赞状态下直接切换为踩", async () => {
    vi.mocked(postsApi.fetchPostById).mockResolvedValue({ post: makePost({ myVote: "like" }) });
    const { wrapper } = await mountDetail(READER);

    await button(wrapper, "踩").trigger("click");
    await flushPromises();

    expect(postsApi.votePost).toHaveBeenCalledWith(POST_ID, "dislike");
  });

  it("收藏调用收藏接口并提示，再次点击取消收藏", async () => {
    const { wrapper } = await mountDetail(READER);

    await button(wrapper, "收藏").trigger("click");
    await flushPromises();

    expect(postsApi.setPostFavoriteHttp).toHaveBeenCalledWith(POST_ID, true);
    expect(messageSpies.success).toHaveBeenCalledWith("已加入收藏");
    expect(hasButton(wrapper, "已收藏")).toBe(true);

    await button(wrapper, "已收藏").trigger("click");
    await flushPromises();

    expect(postsApi.setPostFavoriteHttp).toHaveBeenLastCalledWith(POST_ID, false);
    expect(messageSpies.success).toHaveBeenCalledWith("已取消收藏");
  });
});

describe("PostDetailView / 文章归属权限", () => {
  it("作者本人可以看到编辑与删除入口", async () => {
    const { wrapper } = await mountDetail(AUTHOR);
    expect(wrapper.find(".owner-tools").exists()).toBe(true);
  });

  it("非作者看不到编辑与删除入口", async () => {
    const { wrapper } = await mountDetail(READER);
    expect(wrapper.find(".owner-tools").exists()).toBe(false);
  });

  it("未登录访客看不到编辑与删除入口", async () => {
    const { wrapper } = await mountDetail();
    expect(wrapper.find(".owner-tools").exists()).toBe(false);
  });

  it("点击编辑跳转到编辑页", async () => {
    const { wrapper, router } = await mountDetail(AUTHOR);

    await button(wrapper.find(".owner-tools"), "编辑").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("editor-edit");
    expect(router.currentRoute.value.params.id).toBe(String(POST_ID));
  });

  it("删除文章需二次确认，确认后删除并回到首页", async () => {
    const { wrapper, router } = await mountDetail(AUTHOR);

    await button(wrapper.find(".owner-tools"), "删除").trigger("click");
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalled();
    expect(postsApi.deletePost).toHaveBeenCalledWith(POST_ID);
    expect(messageSpies.success).toHaveBeenCalledWith("已删除");
    expect(router.currentRoute.value.name).toBe("home");
  });

  it("确认框被取消时不删除文章", async () => {
    rejectNextConfirm();
    const { wrapper, router } = await mountDetail(AUTHOR);

    await button(wrapper.find(".owner-tools"), "删除").trigger("click");
    await flushPromises();

    expect(postsApi.deletePost).not.toHaveBeenCalled();
    expect(router.currentRoute.value.name).toBe("post-detail");
  });
});

describe("PostDetailView / 评论列表", () => {
  it("按页拉取评论并渲染主评与楼内回复", async () => {
    const { wrapper } = await mountDetail();

    expect(commentsApi.fetchComments).toHaveBeenCalledWith(POST_ID, 1, 20);
    expect(wrapper.findAll(".thread")).toHaveLength(2);
    expect(wrapper.text()).toContain("较早的主评");
    expect(wrapper.text()).toContain("楼内直接回复");
    expect(wrapper.findAll(".reply")).toHaveLength(2);
  });

  it("默认按时间倒序，切换后变正序", async () => {
    const { wrapper } = await mountDetail();

    expect(wrapper.findAll(".thread")[0].text()).toContain("较晚的主评");

    await button(wrapper, "按时间正序").trigger("click");
    expect(wrapper.findAll(".thread")[0].text()).toContain("较早的主评");

    await button(wrapper, "按时间倒序").trigger("click");
    expect(wrapper.findAll(".thread")[0].text()).toContain("较晚的主评");
  });

  it("回复的回复渲染成「作者 ▸ 被回复者」的链路", async () => {
    const { wrapper } = await mountDetail();

    const chain = wrapper.find(".c-reply-chain");
    expect(chain.exists()).toBe(true);
    expect(chain.text()).toContain("deep-replier");
    expect(chain.text()).toContain("replier");
  });

  it("没有评论时显示空态", async () => {
    vi.mocked(commentsApi.fetchComments).mockResolvedValue(makeCommentsResult([]));
    const { wrapper } = await mountDetail();

    expect(wrapper.findAll(".thread")).toHaveLength(0);
    expect(wrapper.find(".el-empty").text()).toContain("暂无评论");
  });

  it("评论总数以分页返回的 commentTotal 为准", async () => {
    vi.mocked(commentsApi.fetchComments).mockResolvedValue(
      makeCommentsResult([EARLIER], { commentTotal: 87 }),
    );
    const { wrapper } = await mountDetail();

    expect(wrapper.find(".comments-hd .count").text()).toBe("87");
  });
});

describe("PostDetailView / 发表评论", () => {
  it("登录后可见评论输入框", async () => {
    const { wrapper } = await mountDetail(READER);
    expect(wrapper.find(".composer").exists()).toBe(true);
  });

  it("提交评论后调用接口、清空输入框并重新拉取列表", async () => {
    const { wrapper } = await mountDetail(READER);

    const input = wrapper.find(".composer textarea");
    await input.setValue("这是一条新评论");
    await button(wrapper, "发布评论").trigger("click");
    await flushPromises();

    expect(commentsApi.createComment).toHaveBeenCalledWith(POST_ID, {
      content: "这是一条新评论",
    });
    expect(messageSpies.success).toHaveBeenCalledWith("发表成功");
    expect((wrapper.find(".composer textarea").element as HTMLTextAreaElement).value).toBe("");
    // 首屏一次 + 提交后重新拉取一次
    expect(vi.mocked(commentsApi.fetchComments).mock.calls.length).toBe(2);
    expect(vi.mocked(postsApi.fetchPostById).mock.calls.length).toBe(2);
  });

  it("内容为空时只提示、不发请求", async () => {
    const { wrapper } = await mountDetail(READER);

    await button(wrapper, "发布评论").trigger("click");
    await flushPromises();

    expect(commentsApi.createComment).not.toHaveBeenCalled();
    expect(messageSpies.warning).toHaveBeenCalledWith("请输入评论内容");
  });

  it("只输入空白字符同样视为空内容", async () => {
    const { wrapper } = await mountDetail(READER);

    await wrapper.find(".composer textarea").setValue("   \n  ");
    await button(wrapper, "发布评论").trigger("click");
    await flushPromises();

    expect(commentsApi.createComment).not.toHaveBeenCalled();
    expect(messageSpies.warning).toHaveBeenCalledWith("请输入评论内容");
  });
});

describe("PostDetailView / 楼内回复", () => {
  it("点击回复后出现内联输入框，提交时带上 parentId", async () => {
    const { wrapper } = await mountDetail(READER);

    const thread = wrapper.findAll(".thread")[0];
    await thread
      .findAll("button")
      .filter((b) => b.text() === "回复")[0]
      .trigger("click");

    const inline = wrapper.find(".inline-composer");
    expect(inline.exists()).toBe(true);

    await inline.find("textarea").setValue("我来回一句");
    await button(inline, "发布").trigger("click");
    await flushPromises();

    // 倒序下第一条主评是 LATER(id=101)
    expect(commentsApi.createComment).toHaveBeenCalledWith(POST_ID, {
      content: "我来回一句",
      parentId: 101,
    });
  });

  it("回复楼内某条回复时 parentId 指向那条回复", async () => {
    const { wrapper } = await mountDetail(READER);

    const reply = wrapper.findAll(".reply")[0];
    await reply
      .findAll("button")
      .filter((b) => b.text() === "回复")[0]
      .trigger("click");

    const inline = wrapper.find(".inline-composer");
    await inline.find("textarea").setValue("针对楼内回复");
    await button(inline, "发布").trigger("click");
    await flushPromises();

    expect(commentsApi.createComment).toHaveBeenCalledWith(POST_ID, {
      content: "针对楼内回复",
      parentId: 201,
    });
  });

  it("取消后内联输入框消失", async () => {
    const { wrapper } = await mountDetail(READER);

    const thread = wrapper.findAll(".thread")[0];
    await thread
      .findAll("button")
      .filter((b) => b.text() === "回复")[0]
      .trigger("click");
    expect(wrapper.find(".inline-composer").exists()).toBe(true);

    await button(wrapper.find(".inline-composer"), "取消").trigger("click");
    expect(wrapper.find(".inline-composer").exists()).toBe(false);
  });

  it("回复内容为空时只提示、不发请求", async () => {
    const { wrapper } = await mountDetail(READER);

    const thread = wrapper.findAll(".thread")[0];
    await thread
      .findAll("button")
      .filter((b) => b.text() === "回复")[0]
      .trigger("click");
    await button(wrapper.find(".inline-composer"), "发布").trigger("click");
    await flushPromises();

    expect(commentsApi.createComment).not.toHaveBeenCalled();
    expect(messageSpies.warning).toHaveBeenCalledWith("请输入回复内容");
  });

  it("同一时刻只存在一个内联输入框", async () => {
    const { wrapper } = await mountDetail(READER);

    const threads = wrapper.findAll(".thread");
    await threads[0]
      .findAll("button")
      .filter((b) => b.text() === "回复")[0]
      .trigger("click");
    await threads[1]
      .findAll("button")
      .filter((b) => b.text() === "回复")[0]
      .trigger("click");

    expect(wrapper.findAll(".inline-composer")).toHaveLength(1);
  });
});

describe("PostDetailView / 评论删除权限", () => {
  it("评论作者本人可以删除自己的评论", async () => {
    const { wrapper } = await mountDetail(COMMENTER);

    const own = findContainingText(wrapper, ".thread", "较早的主评");
    expect(own).toBeDefined();
    expect(hasButton(own!, "删除")).toBe(true);
  });

  it("普通用户不能删除别人的评论", async () => {
    const { wrapper } = await mountDetail(READER);

    const others = findContainingText(wrapper, ".thread", "较早的主评");
    expect(hasButton(others!, "删除")).toBe(false);
  });

  it("文章作者可以删除文章下的任意评论", async () => {
    const { wrapper } = await mountDetail(AUTHOR);

    const others = findContainingText(wrapper, ".thread", "较早的主评");
    expect(hasButton(others!, "删除")).toBe(true);
  });

  it("持有 admin.comments.delete 权限的用户可以删除任意评论", async () => {
    const { wrapper } = await mountDetail({
      ...READER,
      permissions: ["admin.comments.delete"],
    });

    const others = findContainingText(wrapper, ".thread", "较早的主评");
    expect(hasButton(others!, "删除")).toBe(true);
  });

  it("删除评论需二次确认，确认后调用接口并刷新", async () => {
    const { wrapper } = await mountDetail(COMMENTER);

    const own = findContainingText(wrapper, ".thread", "较早的主评");
    await button(own!, "删除").trigger("click");
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalled();
    expect(commentsApi.deleteComment).toHaveBeenCalledWith(POST_ID, 100);
    expect(messageSpies.success).toHaveBeenCalledWith("已删除");
    expect(vi.mocked(commentsApi.fetchComments).mock.calls.length).toBe(2);
  });

  it("取消确认时不删除评论", async () => {
    rejectNextConfirm();
    const { wrapper } = await mountDetail(COMMENTER);

    const own = findContainingText(wrapper, ".thread", "较早的主评");
    await button(own!, "删除").trigger("click");
    await flushPromises();

    expect(commentsApi.deleteComment).not.toHaveBeenCalled();
  });
});
