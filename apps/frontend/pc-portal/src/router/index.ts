import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "@/stores/auth";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("@/views/HomeView.vue"),
      meta: { title: "首页" },
    },
    {
      path: "/demo/category-feed",
      name: "category-feed-demo",
      component: () => import("@/views/category-feed/CategoryFeedDemoView.vue"),
      meta: { title: "分类内容流（演示）", blankLayout: true },
    },
    {
      path: "/posts/:id",
      name: "post-detail",
      component: () => import("@/views/PostDetailView.vue"),
      meta: { title: "文章" },
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
      meta: { title: "登录", guestOnly: true },
    },
    {
      path: "/register",
      name: "register",
      component: () => import("@/views/RegisterView.vue"),
      meta: { title: "注册", guestOnly: true },
    },
    {
      path: "/mine",
      name: "mine",
      component: () => import("@/views/MinePostsView.vue"),
      meta: { title: "我的文章", requiresAuth: true },
    },
    {
      path: "/mine/editor",
      name: "editor-new",
      component: () => import("@/views/PostEditorView.vue"),
      meta: { title: "写文章", requiresAuth: true },
    },
    {
      path: "/mine/editor/:id",
      name: "editor-edit",
      component: () => import("@/views/PostEditorView.vue"),
      meta: { title: "编辑文章", requiresAuth: true },
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }
  if (to.meta.guestOnly && auth.isLoggedIn) {
    return { path: "/" };
  }
  return true;
});

export default router;
