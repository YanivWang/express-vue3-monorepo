import { describe, expect, it } from "vitest";

import type { Pagination, PostItem } from "@/api/types";
import { mountApp } from "@/test/app-harness";
import { makePost } from "@/test/fixtures";

import PostFeedBoard from "./PostFeedBoard.vue";

import type { Component } from "vue";

/**
 * PostFeedBoard 的行为基线（写在拆分之前，拆分后不得修改）。
 *
 * 这个组件被首页、搜索页、收藏页三处共用，props / events / 插槽构成对外契约，
 * 拆分时最容易被顺手改动的就是它——因此断言全部压在契约面上：
 * 渲染出什么文案、什么条件下出现分页、点哪里会 emit 什么。
 */

function makePagination(overrides: Partial<Pagination> = {}): Pagination {
  return { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, ...overrides };
}

interface BoardOptions {
  posts?: PostItem[];
  loading?: boolean;
  pagination?: Pagination | null;
  feedPage?: number;
  emptyDescription?: string;
  toolbar?: string;
}

async function mountBoard(options: BoardOptions = {}) {
  return mountApp(PostFeedBoard as Component, {
    props: {
      posts: options.posts ?? [],
      loading: options.loading ?? false,
      pagination: options.pagination ?? null,
      feedPage: options.feedPage ?? 1,
      ...(options.emptyDescription != null ? { emptyDescription: options.emptyDescription } : {}),
    },
    ...(options.toolbar != null ? { slots: { toolbar: options.toolbar } } : {}),
  });
}

describe("PostFeedBoard / 工具栏插槽", () => {
  it("传了 toolbar 插槽才渲染工具栏容器", async () => {
    const withSlot = await mountBoard({ toolbar: '<span class="probe">排序</span>' });
    expect(withSlot.wrapper.find(".feed-board__toolbar").exists()).toBe(true);
    expect(withSlot.wrapper.find(".probe").text()).toBe("排序");

    const withoutSlot = await mountBoard();
    expect(withoutSlot.wrapper.find(".feed-board__toolbar").exists()).toBe(false);
  });
});

describe("PostFeedBoard / 空态", () => {
  it("无文章且非加载中时显示默认空态文案", async () => {
    const { wrapper } = await mountBoard();

    expect(wrapper.find(".feed-empty").exists()).toBe(true);
    expect(wrapper.find(".feed-empty").text()).toContain("暂无文章");
  });

  it("emptyDescription 可覆盖空态文案", async () => {
    const { wrapper } = await mountBoard({ emptyDescription: "还没有收藏任何文章" });

    expect(wrapper.find(".feed-empty").text()).toContain("还没有收藏任何文章");
  });

  it("加载中不显示空态，避免首屏闪一下「暂无文章」", async () => {
    const { wrapper } = await mountBoard({ loading: true });

    expect(wrapper.find(".feed-empty").exists()).toBe(false);
  });

  it("有文章时不显示空态", async () => {
    const { wrapper } = await mountBoard({ posts: [makePost()] });

    expect(wrapper.find(".feed-empty").exists()).toBe(false);
  });
});

describe("PostFeedBoard / 卡片内容", () => {
  it("每篇文章渲染一张卡片，并展示标题、摘要、作者与分类", async () => {
    const posts = [
      makePost({ id: 1, title: "第一篇", content: "<p>正文一</p>" }),
      makePost({ id: 2, title: "第二篇", content: "<p>正文二</p>" }),
    ];
    const { wrapper } = await mountBoard({ posts });

    const cards = wrapper.findAll(".feed-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].find(".feed-card__title").text()).toBe("第一篇");
    expect(cards[0].find(".feed-card__abstract").text()).toBe("正文一");
    expect(cards[0].find(".feed-card__author").text()).toBe("author-one");
    expect(cards[0].find(".feed-card__cat").text()).toBe("前端工程");
  });

  it("摘要取正文纯文本，HTML 标签不出现在列表里", async () => {
    const post = makePost({ content: "<h2>小标题</h2><p>正文<strong>加粗</strong></p>" });
    const { wrapper } = await mountBoard({ posts: [post] });

    const abstract = wrapper.find(".feed-card__abstract").text();
    expect(abstract).toBe("小标题 正文 加粗");
    expect(abstract).not.toContain("<");
  });

  it("作者与分类缺失时回落为占位文案", async () => {
    const post = makePost({ author: undefined, category: undefined });
    const { wrapper } = await mountBoard({ posts: [post] });

    expect(wrapper.find(".feed-card__author").text()).toBe("—");
    expect(wrapper.find(".feed-card__cat").text()).toBe("未分类");
  });

  it("时间以 datetime 保留原始值，文案为年.月.日", async () => {
    const post = makePost({ createdAt: "2026-01-02T03:04:05.000Z" });
    const { wrapper } = await mountBoard({ posts: [post] });

    const time = wrapper.find(".feed-card__time");
    expect(time.attributes("datetime")).toBe("2026-01-02T03:04:05.000Z");
    expect(time.text()).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });

  it("非法时间原样回显而不是渲染成 Invalid Date", async () => {
    const post = makePost({ createdAt: "not-a-date" });
    const { wrapper } = await mountBoard({ posts: [post] });

    expect(wrapper.find(".feed-card__time").text()).toBe("not-a-date");
  });
});

describe("PostFeedBoard / 互动数据", () => {
  it("按评论、收藏、点赞的顺序展示三个计数", async () => {
    const post = makePost({ commentCount: 2, favoriteCount: 5, likeCount: 9 });
    const { wrapper } = await mountBoard({ posts: [post] });

    const stats = wrapper.findAll(".feed-card__stat").map((s) => s.text().trim());
    expect(stats).toEqual(["2", "5", "9"]);
  });

  it("计数缺失或为负都显示 0", async () => {
    const post = makePost({ commentCount: undefined, favoriteCount: -3, likeCount: 0 });
    const { wrapper } = await mountBoard({ posts: [post] });

    const stats = wrapper.findAll(".feed-card__stat").map((s) => s.text().trim());
    expect(stats).toEqual(["0", "0", "0"]);
  });

  it("超过 99999 的计数收敛为 99999+，避免撑破卡片布局", async () => {
    const post = makePost({ commentCount: 99999, favoriteCount: 100000, likeCount: 1234567 });
    const { wrapper } = await mountBoard({ posts: [post] });

    const stats = wrapper.findAll(".feed-card__stat").map((s) => s.text().trim());
    expect(stats).toEqual(["99999", "99999+", "99999+"]);
  });
});

describe("PostFeedBoard / 封面图", () => {
  it("正文首张图片作为卡片封面", async () => {
    const post = makePost({ content: '<p>前言</p><img src="https://cdn.test/a.png" />' });
    const { wrapper } = await mountBoard({ posts: [post] });

    expect(wrapper.find(".feed-card__thumb").attributes("src")).toBe("https://cdn.test/a.png");
  });

  it("正文无图时不渲染封面容器", async () => {
    const post = makePost({ content: "<p>纯文字</p>" });
    const { wrapper } = await mountBoard({ posts: [post] });

    expect(wrapper.find(".feed-card__thumb-wrap").exists()).toBe(false);
  });
});

describe("PostFeedBoard / 选中文章", () => {
  it("点击卡片 emit select-post 并带上文章 id", async () => {
    const { wrapper } = await mountBoard({ posts: [makePost({ id: 42 })] });

    await wrapper.find(".feed-card").trigger("click");

    expect(wrapper.emitted("select-post")).toEqual([[42]]);
  });

  it("点击卡片内部元素同样触发选中", async () => {
    const { wrapper } = await mountBoard({ posts: [makePost({ id: 7 })] });

    await wrapper.find(".feed-card__title").trigger("click");

    expect(wrapper.emitted("select-post")).toEqual([[7]]);
  });

  it("回车键触发选中，键盘用户不必依赖鼠标", async () => {
    const { wrapper } = await mountBoard({ posts: [makePost({ id: 9 })] });

    await wrapper.find(".feed-card").trigger("keydown.enter");

    expect(wrapper.emitted("select-post")).toEqual([[9]]);
  });

  it("点击卡片内的链接不触发选中，链接自身的跳转优先", async () => {
    const { wrapper } = await mountBoard({ posts: [makePost({ id: 5 })] });

    // 卡片正文将来可能内嵌链接；此处直接在卡片内插入一个 a 来验证这条既有的让位规则
    const card = wrapper.find(".feed-card").element;
    const anchor = document.createElement("a");
    anchor.href = "https://example.test";
    card.appendChild(anchor);
    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(wrapper.emitted("select-post")).toBeUndefined();
  });

  it("多张卡片各自 emit 自己的 id", async () => {
    const posts = [makePost({ id: 11 }), makePost({ id: 22 })];
    const { wrapper } = await mountBoard({ posts });

    await wrapper.findAll(".feed-card")[1].trigger("click");

    expect(wrapper.emitted("select-post")).toEqual([[22]]);
  });
});

describe("PostFeedBoard / 分页", () => {
  it("只有一页时不渲染分页器", async () => {
    const { wrapper } = await mountBoard({
      posts: [makePost()],
      pagination: makePagination({ totalPages: 1 }),
    });

    expect(wrapper.find(".pager").exists()).toBe(false);
  });

  it("pagination 为空时不渲染分页器", async () => {
    const { wrapper } = await mountBoard({ posts: [makePost()], pagination: null });

    expect(wrapper.find(".pager").exists()).toBe(false);
  });

  it("多页时渲染分页器并按 feedPage 高亮当前页", async () => {
    const { wrapper } = await mountBoard({
      posts: [makePost()],
      pagination: makePagination({ total: 30, totalPages: 3 }),
      feedPage: 2,
    });

    expect(wrapper.find(".pager").exists()).toBe(true);
    expect(wrapper.find(".el-pager .is-active").text()).toBe("2");
  });

  it("点击页码 emit page-change", async () => {
    const { wrapper } = await mountBoard({
      posts: [makePost()],
      pagination: makePagination({ total: 30, totalPages: 3 }),
      feedPage: 1,
    });

    const pageThree = wrapper.findAll(".el-pager li").find((li) => li.text() === "3");
    await pageThree!.trigger("click");

    expect(wrapper.emitted("page-change")).toEqual([[3]]);
  });
});
