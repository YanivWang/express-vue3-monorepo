import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, h, type Component } from "vue";
import { createMemoryHistory, createRouter, RouterView, type Router } from "vue-router";

import type { CurrentUserProfile } from "@/api/types";
import { useAuthStore } from "@/stores/auth";

import { RouteStub } from "./route-stub";

/**
 * 挂载被测视图的统一入口（与 pc-portal 同构）。
 *
 * 管理端的每个视图都由权限码决定能看到什么、能点什么，
 * 所以这里把「以某组权限登录」做成一等公民。
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

export function makeAccessToken(user: TestUser): string {
  const payload = base64Url(JSON.stringify({ id: user.id, username: user.username }));
  return `header.${payload}.signature`;
}

export function profileFor(user: TestUser): CurrentUserProfile {
  return {
    id: user.id,
    username: user.username,
    avatar: null,
    nickname: null,
    permissions: user.permissions ?? [],
  };
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

/** 与 src/router/index.ts 的 name 对齐 */
export function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/login", name: "login", component: RouteStub },
      { path: "/403", name: "forbidden", component: RouteStub },
      { path: "/posts", name: "posts", component: RouteStub },
      { path: "/categories", name: "categories", component: RouteStub },
      { path: "/portal-users", name: "portal-users", component: RouteStub },
      { path: "/comments", name: "comments", component: RouteStub },
      { path: "/system/roles", name: "roles", component: RouteStub },
      { path: "/system/staff", name: "staff", component: RouteStub },
    ],
  });
}

export function signIn(user: TestUser): void {
  const auth = useAuthStore();
  auth.token = makeAccessToken(user);
  auth.profile = profileFor(user);
}

export interface MountAppOptions {
  path?: string;
  user?: TestUser;
  props?: Record<string, unknown>;
  slots?: Record<string, string>;
  /** 路由视图传路由名，组件将经 <router-view> 渲染（与线上的卸载时机一致） */
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
    router.addRoute({ path: target.path, name: options.routeName, component });
  }

  await router.push(options.path ?? "/posts");
  await router.isReady();

  const wrapper = mount(options.routeName === undefined ? component : RouterHost, {
    props: options.props,
    slots: options.slots,
    global: { plugins: [pinia, router] },
  });

  await flushPromises();
  return { wrapper, router };
}
