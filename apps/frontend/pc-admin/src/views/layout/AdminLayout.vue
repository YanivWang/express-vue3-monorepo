<script setup lang="ts">
import { Fold, Expand, Document, Menu, UserFilled, ChatLineRound } from "@element-plus/icons-vue";
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAuthStore } from "@/stores/auth";
import { hasAnyPermission } from "@/utils/permissions";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const collapsed = ref(false);

const perms = computed(() => auth.permissions);

function can(codes: readonly string[]) {
  return hasAnyPermission(perms.value, codes);
}

const showSystemMenu = computed(
  () =>
    hasAnyPermission(perms.value, ["admin.roles.manage"]) ||
    hasAnyPermission(perms.value, ["admin.staff.read"]),
);

async function signOut() {
  await auth.logout();
  router.push("/login");
}
</script>

<template>
  <el-container style="height: 100vh">
    <el-aside :width="collapsed ? '64px' : '220px'" class="aside">
      <div class="aside__brand">{{ collapsed ? "A" : "管理后台" }}</div>
      <el-menu
        :default-active="route.path"
        :collapse="collapsed"
        router
        background-color="#1f2937"
        text-color="#e5e7eb"
        active-text-color="#93c5fd"
      >
        <el-menu-item v-if="can(['admin.posts.read'])" index="/posts">
          <el-icon><Document /></el-icon>
          <span>帖子管理</span>
        </el-menu-item>
        <el-menu-item
          v-if="can(['admin.categories.write', 'admin.categories.delete'])"
          index="/categories"
        >
          <el-icon><Menu /></el-icon>
          <span>分类管理</span>
        </el-menu-item>
        <el-menu-item v-if="can(['admin.portal_users.read'])" index="/portal-users">
          <el-icon><UserFilled /></el-icon>
          <span>注册用户</span>
        </el-menu-item>
        <el-menu-item v-if="can(['admin.comments.read'])" index="/comments">
          <el-icon><ChatLineRound /></el-icon>
          <span>评论管理</span>
        </el-menu-item>
        <el-sub-menu v-if="showSystemMenu" index="/system">
          <template #title>
            <span>系统管理</span>
          </template>
          <el-menu-item v-if="can(['admin.roles.manage'])" index="/system/roles">
            角色管理
          </el-menu-item>
          <el-menu-item v-if="can(['admin.staff.read'])" index="/system/staff">
            管理员账号
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="admin-layout__header" height="56px">
        <div style="display: flex; gap: 12px; align-items: center">
          <el-button text @click="collapsed = !collapsed">
            <el-icon><Expand v-if="collapsed" /><Fold v-else /></el-icon>
          </el-button>
          <span class="admin-layout__title">{{ route.meta.title ?? "控制台" }}</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center">
          <span>{{ auth.profile?.username }}</span>
          <el-button type="primary" link @click="signOut">退出</el-button>
        </div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped lang="scss">
.aside {
  color: #e5e7eb;
  background: #1f2937;
}

.aside__brand {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  font-weight: 700;
  border-bottom: 1px solid #374151;
}

.el-menu {
  border-right: none;
}

.admin-layout__header {
  border-bottom: 1px solid #e5e7eb;
}
</style>
