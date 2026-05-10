import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "@/stores/auth";
import { hasAnyPermission, hasStaffEntry } from "@/utils/permissions";

NProgress.configure({ showSpinner: false });

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      name: "login",
      meta: { title: "登录" },
      component: () => import("@/views/LoginView.vue"),
    },
    {
      path: "/403",
      name: "forbidden",
      meta: { title: "无权访问" },
      component: () => import("@/views/ForbiddenView.vue"),
    },
    {
      path: "/",
      component: () => import("@/views/layout/AdminLayout.vue"),
      redirect: "/posts",
      children: [
        {
          path: "posts",
          name: "posts",
          meta: { title: "帖子管理", permissions: ["admin.posts.read"] },
          component: () => import("@/views/posts/PostsView.vue"),
        },
        {
          path: "categories",
          name: "categories",
          meta: {
            title: "分类管理",
            permissions: ["admin.categories.write", "admin.categories.delete"],
          },
          component: () => import("@/views/categories/CategoriesView.vue"),
        },
        {
          path: "portal-users",
          name: "portal-users",
          meta: { title: "注册用户", permissions: ["admin.portal_users.read"] },
          component: () => import("@/views/portal/PortalUsersView.vue"),
        },
        {
          path: "comments",
          name: "comments",
          meta: { title: "评论管理", permissions: ["admin.comments.read"] },
          component: () => import("@/views/comments/CommentsView.vue"),
        },
        {
          path: "system/roles",
          name: "roles",
          meta: { title: "角色管理", permissions: ["admin.roles.manage"] },
          component: () => import("@/views/system/RolesView.vue"),
        },
        {
          path: "system/staff",
          name: "staff",
          meta: { title: "管理员账号", permissions: ["admin.staff.read"] },
          component: () => import("@/views/system/StaffView.vue"),
        },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  NProgress.start();
  const auth = useAuthStore();
  const white = new Set(["/login", "/403"]);

  if (white.has(to.path)) {
    if (to.path === "/login" && auth.isLoggedIn) {
      await auth.bootstrapSession();
      if (hasStaffEntry(auth.permissions)) {
        return "/posts";
      }
    }
    return true;
  }

  if (!auth.isLoggedIn) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  await auth.bootstrapSession();
  if (!auth.isLoggedIn) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  if (!hasStaffEntry(auth.permissions)) {
    return { path: "/403" };
  }

  const need = (to.meta?.permissions ?? []) as string[];
  if (need.length > 0 && !hasAnyPermission(auth.permissions, need)) {
    return { path: "/403" };
  }

  return true;
});

router.afterEach(() => {
  NProgress.done();
});

export default router;
