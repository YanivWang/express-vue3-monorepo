import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, h, type Component } from "vue";
import { createMemoryHistory, createRouter, RouterView, type Router } from "vue-router";

import type { CurrentUserProfile } from "@/api/types";
import { useAuthStore } from "@/stores/auth";

import { RouteStub } from "./route-stub";

/**
 * 挂载被测视图的统一入口。
 *
 * 刻意用「真 Pinia + 真 vue-router（memory history）」而不是 mock：
 * 这两者是组件的运行底座，换成假的就测不出路由跳转、登录态派生这类真实分支。
 * 需要挡的是网络，那由各用例自己 vi.mock("@/api/*")。
 */

export interface TestUser {
  id: number;
  /** 保持 ASCII：JWT 载荷经 atob 解码，非 ASCII 会乱码（与线上行为一致） */
  username: string;
  permissions?: string[];
}

function base64Url(text: string): string {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 造一个只有 payload 有意义的访问令牌——前端只解码不验签（见 utils/jwt.ts） */
export function makeAccessToken(user: TestUser): string {
  const payload = base64Url(JSON.stringify({ id: user.id, username: user.username }));
  return `header.${payload}.signature`;
}

/** 与 src/router/index.ts 的 name 对齐；组件用占位件，跳转目标本身不是被测对象 */
export function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: RouteStub },
      { path: "/search", name: "search", component: RouteStub },
      { path: "/posts/:id", name: "post-detail", component: RouteStub },
      { path: "/login", name: "login", component: RouteStub },
      { path: "/register", name: "register", component: RouteStub },
      { path: "/mine", name: "mine", component: RouteStub },
      { path: "/mine/profile", name: "profile", component: RouteStub },
      { path: "/mine/profile/edit", name: "profile-edit", component: RouteStub },
      { path: "/favorites", name: "favorites", component: RouteStub },
      { path: "/mine/editor", name: "editor-new", component: RouteStub },
      { path: "/mine/editor/:id", name: "editor-edit", component: RouteStub },
      { path: "/demo/category-feed", name: "category-feed-demo", component: RouteStub },
      { path: "/test/big-file-upload", name: "big-file-upload", component: RouteStub },
    ],
  });
}

/**
 * 由 TestUser 推出 /api/me 的返回体。
 * 用例 mock fetchCurrentUser 时要复用它：视图 onMounted 会再拉一次 profile，
 * 若两处不一致，权限判断会在挂载后被静默改写。
 */
export function profileFor(user: TestUser): CurrentUserProfile {
  return {
    id: user.id,
    username: user.username,
    avatar: null,
    nickname: null,
    permissions: user.permissions ?? [],
  };
}

/** 在当前激活的 Pinia 上写入登录态；必须早于 mount，组件 setup 期就会读它 */
export function signIn(user: TestUser): void {
  const auth = useAuthStore();
  auth.setTokenFromLogin(makeAccessToken(user));
  auth.profile = profileFor(user);
}

/**
 * 承载被测路由视图的最小宿主，只渲染一个 <router-view>。
 * 必须是有状态组件：@vue/test-utils 挂载函数式组件时 wrapper.vm 为 null，
 * find / findAll 会直接抛 "Cannot read properties of null"。
 */
const RouterHost = defineComponent({
  name: "RouterHost",
  render: () => h(RouterView),
});

export interface MountAppOptions {
  /** 初始路由，默认 "/" */
  path?: string;
  /** 传入则先登录再挂载；不传即未登录态 */
  user?: TestUser;
  props?: Record<string, unknown>;
  slots?: Record<string, string>;
  /**
   * 路由视图请传它对应的路由名，组件会被接到该路由上、经 <router-view> 渲染。
   *
   * 为什么不直接 mount：直接挂的组件在路由跳走后仍留在树上，
   * 会拿着已经变空的 route.params 再渲染一次——那是测试台自己造出来的状态，
   * 线上由 <router-view> 卸载，根本不会发生。
   */
  routeName?: string;
}

export async function mountApp(component: Component, options: MountAppOptions = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);

  if (options.user) signIn(options.user);

  const router = createTestRouter();

  if (options.routeName !== undefined) {
    const target = router.getRoutes().find((route) => route.name === options.routeName);
    if (!target) throw new Error(`createTestRouter 里没有名为「${options.routeName}」的路由`);
    // 同名 addRoute 会替换原有记录，把占位件换成被测组件
    router.addRoute({ path: target.path, name: options.routeName, component });
  }

  await router.push(options.path ?? "/");
  await router.isReady();

  const wrapper = mount(options.routeName === undefined ? component : RouterHost, {
    props: options.props,
    slots: options.slots,
    global: { plugins: [pinia, router] },
  });

  // 视图普遍在 setup / onMounted 里发起加载，等一轮微任务让首屏数据落位
  await flushPromises();
  return { wrapper, router };
}
