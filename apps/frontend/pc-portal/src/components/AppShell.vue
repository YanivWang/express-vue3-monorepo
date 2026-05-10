<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import { fetchCategories } from "@/api/categories";
import type { CategoryTreeNode } from "@/api/types";
import { useAuthStore } from "@/stores/auth";
import { findParentIdOfLeaf } from "@/utils/categoryTree";

const categories = ref<CategoryTreeNode[]>([]);
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { isLoggedIn, claims } = storeToRefs(auth);

const activeChannel = ref("all");

function syncTabFromRoute() {
  if (route.path !== "/") {
    activeChannel.value = "";
    return;
  }
  const cat = route.query.categoryId;
  if (cat != null && cat !== "") {
    const rawCat = Array.isArray(cat) ? cat[0] : cat;
    const leafNum = Number(rawCat);
    if (Number.isFinite(leafNum) && categories.value.length > 0) {
      const rootId = findParentIdOfLeaf(categories.value, leafNum);
      if (rootId != null) {
        activeChannel.value = `p-${rootId}`;
        return;
      }
    }
  }
  const p = route.query.parentId;
  if (p == null || p === "") activeChannel.value = "all";
  else {
    const raw = Array.isArray(p) ? p[0] : p;
    activeChannel.value = `p-${raw ?? ""}`;
  }
}

watch(
  () => [route.path, route.query.parentId, route.query.categoryId, categories.value],
  () => syncTabFromRoute(),
  { immediate: true },
);

onMounted(async () => {
  try {
    const { categories: tree } = await fetchCategories();
    categories.value = tree;
  } catch {
    /* 顶栏错误由 http 层提示 */
  }
});

function onChannelSelect(key: string) {
  if (key === "all") {
    void router.push({ path: "/", query: {} });
    return;
  }
  if (key.startsWith("p-")) {
    const id = key.slice(2);
    void router.push({ path: "/", query: { parentId: id } });
  }
}

function goMine() {
  void router.push({ name: "mine" });
}

function goEditor() {
  void router.push({ name: "editor-new" });
}

function goLogin() {
  void router.push({ name: "login", query: { redirect: route.fullPath } });
}

function goRegister() {
  void router.push({ name: "register" });
}

function onLogout() {
  auth.logout();
  void router.push({ name: "home" });
}
</script>

<template>
  <div class="app-shell">
    <header class="top">
      <div class="top-inner">
        <RouterLink class="logo" :to="{ path: '/', query: {} }">门户</RouterLink>
        <el-menu
          v-if="route.path === '/'"
          :key="activeChannel"
          mode="horizontal"
          class="channel-menu"
          :ellipsis="false"
          :default-active="activeChannel"
          @select="onChannelSelect"
        >
          <el-menu-item index="all">全部</el-menu-item>
          <el-menu-item v-for="c in categories" :key="c.id" :index="`p-${c.id}`">
            {{ c.name }}
          </el-menu-item>
        </el-menu>
        <div v-else class="channel-spacer" />

        <div class="actions">
          <template v-if="isLoggedIn">
            <span class="hello">你好，{{ claims?.username }}</span>
            <el-button link type="primary" @click="goEditor">写文章</el-button>
            <el-button link type="primary" @click="goMine">我的文章</el-button>
            <el-button link @click="onLogout">退出</el-button>
          </template>
          <template v-else>
            <el-button link type="primary" @click="goLogin">登录</el-button>
            <el-button link @click="goRegister">注册</el-button>
          </template>
        </div>
      </div>
    </header>
    <main class="main">
      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  min-height: 100vh;
  color: #333;
  background: #f6f7f9;
}

.top {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.top-inner {
  display: flex;
  gap: 12px;
  align-items: center;
  max-width: 960px;
  padding: 0 16px;
  margin: 0 auto;
}

.logo {
  font-size: 18px;
  font-weight: 600;
  color: #ea6f5a;
  white-space: nowrap;
  text-decoration: none;
}

.channel-menu {
  flex: 1;
  border-bottom: none !important;

  --el-menu-horizontal-height: 52px;
}

.channel-menu :deep(.el-menu-item) {
  font-size: 15px;
}

.channel-spacer {
  flex: 1;
}

.actions {
  display: flex;
  gap: 4px;
  align-items: center;
  white-space: nowrap;
}

.hello {
  margin-right: 8px;
  font-size: 13px;
  color: #666;
}

.main {
  max-width: 960px;
  padding: 24px 16px 48px;
  margin: 0 auto;
}
</style>
