import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ESLint 的类型程序解析不了 .vue SFC 的具体类型（只有 vue-tsc 能），与 main.ts 一致显式标注

import * as authApi from "@/api/auth";
import * as categoriesApi from "@/api/categories";
import type { CategoryTreeNode } from "@/api/types";
import * as userApi from "@/api/user";
import { mountApp, profileFor, type TestUser } from "@/test/app-harness";
import { button, hasButton } from "@/test/dom";

import AppShell from "./AppShell.vue";

import type { Component } from "vue";

/**
 * AppShell 的行为基线（写在拆分之前，拆分后不得修改）。
 *
 * 顶栏是全站每一页都要经过的组件，登录态分支与频道高亮最容易在拆分时被改坏，
 * 因此这两块覆盖得最密。
 */

vi.mock("@/api/categories", () => ({ fetchCategories: vi.fn() }));
vi.mock("@/api/auth", () => ({ login: vi.fn(), register: vi.fn(), logout: vi.fn() }));
vi.mock("@/api/user", () => ({ fetchCurrentUser: vi.fn() }));

const READER: TestUser = { id: 42, username: "reader" };

const CATEGORY_TREE: CategoryTreeNode[] = [
  {
    id: 1,
    name: "技术",
    parentId: null,
    sortOrder: 1,
    children: [{ id: 3, name: "前端工程", parentId: 1, sortOrder: 1 }],
  },
  { id: 2, name: "生活", parentId: null, sortOrder: 2, children: [] },
];

let signedIn: TestUser | null = null;

async function mountShell(options: { path?: string; user?: TestUser } = {}) {
  signedIn = options.user ?? null;
  return mountApp(AppShell as Component, {
    path: options.path ?? "/",
    user: options.user,
    slots: { default: '<p class="slot-probe">页面内容</p>' },
  });
}

beforeEach(() => {
  signedIn = null;
  vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({ categories: CATEGORY_TREE });
  vi.mocked(authApi.logout).mockResolvedValue(undefined);
  vi.mocked(userApi.fetchCurrentUser).mockImplementation(() =>
    signedIn
      ? Promise.resolve({ user: profileFor(signedIn) })
      : Promise.reject(new Error("未登录")),
  );
});

describe("AppShell / 基本骨架", () => {
  it("渲染站点 logo 与插槽内容", async () => {
    const { wrapper } = await mountShell();

    expect(wrapper.find(".logo").text()).toBe("码笺");
    expect(wrapper.find(".slot-probe").text()).toBe("页面内容");
  });

  it("详情页与登录页给主区域挂上对应修饰类", async () => {
    const detail = await mountShell({ path: "/posts/1" });
    expect(detail.wrapper.find(".main").classes()).toContain("main--detail");

    const login = await mountShell({ path: "/login" });
    expect(login.wrapper.find(".main").classes()).toContain("main--auth");

    const mine = await mountShell({ path: "/mine" });
    expect(mine.wrapper.find(".main").classes()).not.toContain("main--detail");
  });
});

describe("AppShell / 频道导航", () => {
  it("加载一级分类并渲染为频道按钮", async () => {
    const { wrapper } = await mountShell();

    expect(categoriesApi.fetchCategories).toHaveBeenCalled();
    const items = wrapper.findAll(".channel-nav__item").map((i) => i.text());
    expect(items).toEqual(["首页", "技术", "生活"]);
  });

  it("分类接口失败时顶栏仍然可用", async () => {
    vi.mocked(categoriesApi.fetchCategories).mockRejectedValue(new Error("网络异常"));
    const { wrapper } = await mountShell();

    expect(wrapper.find(".logo").exists()).toBe(true);
    expect(wrapper.findAll(".channel-nav__item").map((i) => i.text())).toEqual(["首页"]);
  });

  it("首页默认高亮「首页」", async () => {
    const { wrapper } = await mountShell();
    const active = wrapper.find(".channel-nav__item.is-active");
    expect(active.text()).toBe("首页");
  });

  it("带 parentId 时高亮对应频道", async () => {
    const { wrapper } = await mountShell({ path: "/?parentId=2" });
    expect(wrapper.find(".channel-nav__item.is-active").text()).toBe("生活");
  });

  it("带二级 categoryId 时高亮它所属的一级频道", async () => {
    const { wrapper } = await mountShell({ path: "/?categoryId=3" });
    expect(wrapper.find(".channel-nav__item.is-active").text()).toBe("技术");
  });

  it("点击频道跳首页并带上 parentId", async () => {
    const { wrapper, router } = await mountShell();

    await button(wrapper, "技术").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/");
    expect(router.currentRoute.value.query.parentId).toBe("1");
  });

  it("点击「首页」清空筛选条件", async () => {
    const { wrapper, router } = await mountShell({ path: "/?parentId=2" });

    await button(wrapper, "首页").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.query.parentId).toBeUndefined();
  });

  it("非频道类路由不显示频道导航", async () => {
    const { wrapper } = await mountShell({ path: "/mine" });
    expect(wrapper.find(".channel-nav").exists()).toBe(false);
  });

  it("详情页与搜索页仍显示频道导航", async () => {
    const detail = await mountShell({ path: "/posts/1" });
    expect(detail.wrapper.find(".channel-nav").exists()).toBe(true);

    const search = await mountShell({ path: "/search" });
    expect(search.wrapper.find(".channel-nav").exists()).toBe(true);
  });
});

describe("AppShell / 全站搜索", () => {
  it("提交关键词跳转搜索页", async () => {
    const { wrapper, router } = await mountShell();

    await wrapper.find(".search__input").setValue("vue 组件拆分");
    await wrapper.find(".top-search").trigger("submit");
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/search");
    expect(router.currentRoute.value.query.q).toBe("vue 组件拆分");
  });

  it("空关键词提交时不带 q 参数", async () => {
    const { wrapper, router } = await mountShell();

    await wrapper.find(".search__input").setValue("   ");
    await wrapper.find(".top-search").trigger("submit");
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/search");
    expect(router.currentRoute.value.query.q).toBeUndefined();
  });

  it("停留在搜索页时输入框回填 URL 上的关键词", async () => {
    const { wrapper } = await mountShell({ path: "/search?q=已有关键词" });
    expect((wrapper.find(".search__input").element as HTMLInputElement).value).toBe("已有关键词");
  });

  it("离开搜索页后输入框清空", async () => {
    const { wrapper } = await mountShell({ path: "/" });
    expect((wrapper.find(".search__input").element as HTMLInputElement).value).toBe("");
  });
});

describe("AppShell / 未登录", () => {
  it("显示登录与注册入口，不显示账户相关入口", async () => {
    const { wrapper } = await mountShell();

    expect(hasButton(wrapper, "登录")).toBe(true);
    expect(hasButton(wrapper, "注册")).toBe(true);
    expect(hasButton(wrapper, "我的文章")).toBe(false);
    expect(hasButton(wrapper, "退出")).toBe(false);
  });

  it("点击登录带上当前路径作为回跳地址", async () => {
    const { wrapper, router } = await mountShell({ path: "/posts/9" });

    await button(wrapper, "登录").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("login");
    expect(router.currentRoute.value.query.redirect).toBe("/posts/9");
  });

  it("点击写文章先去登录，并把编辑页作为回跳地址", async () => {
    const { wrapper, router } = await mountShell();

    await wrapper.find(".btn-write").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("login");
    expect(router.currentRoute.value.query.redirect).toBe("/mine/editor");
  });

  it("点击注册跳注册页", async () => {
    const { wrapper, router } = await mountShell();

    await button(wrapper, "注册").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("register");
  });
});

describe("AppShell / 已登录", () => {
  it("显示账户入口与用户名", async () => {
    const { wrapper } = await mountShell({ user: READER });

    expect(hasButton(wrapper, "我的文章")).toBe(true);
    expect(hasButton(wrapper, "我的收藏")).toBe(true);
    expect(hasButton(wrapper, "个人资料")).toBe(true);
    expect(hasButton(wrapper, "退出")).toBe(true);
    expect(hasButton(wrapper, "登录")).toBe(false);
    expect(wrapper.find(".hello__name").text()).toBe("reader");
  });

  it("没有头像时用用户名首字母大写占位", async () => {
    const { wrapper } = await mountShell({ user: READER });
    expect(wrapper.find(".actions__avatar-placeholder").text()).toBe("R");
  });

  it("点击写文章直接进编辑页", async () => {
    const { wrapper, router } = await mountShell({ user: READER });

    await wrapper.find(".btn-write").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("editor-new");
  });

  it("我的文章与我的收藏各自跳对应页面", async () => {
    const mine = await mountShell({ user: READER });
    await button(mine.wrapper, "我的文章").trigger("click");
    await flushPromises();
    expect(mine.router.currentRoute.value.name).toBe("mine");

    const fav = await mountShell({ user: READER });
    await button(fav.wrapper, "我的收藏").trigger("click");
    await flushPromises();
    expect(fav.router.currentRoute.value.name).toBe("favorites");
  });

  it("退出会通知服务端、清空登录态并回到首页", async () => {
    const { wrapper, router } = await mountShell({ path: "/mine", user: READER });

    await button(wrapper, "退出").trigger("click");
    await flushPromises();

    expect(authApi.logout).toHaveBeenCalled();
    expect(router.currentRoute.value.name).toBe("home");
    expect(hasButton(wrapper, "登录")).toBe(true);
    expect(hasButton(wrapper, "退出")).toBe(false);
  });

  it("服务端登出失败也要清掉本地会话", async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new Error("服务不可用"));
    const { wrapper } = await mountShell({ user: READER });

    await button(wrapper, "退出").trigger("click");
    await flushPromises();

    expect(hasButton(wrapper, "登录")).toBe(true);
  });
});
