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
const { isLoggedIn, displayName, profile } = storeToRefs(auth);

const activeChannel = ref("all");

/** 首页、帖子详情、登录/注册共用顶栏分类导航（详情页沿用 URL query 以保持选中状态） */
function isChannelShellRoute(): boolean {
  return (
    route.path === "/" ||
    route.name === "post-detail" ||
    route.name === "login" ||
    route.name === "register" ||
    route.name === "search"
  );
}

const globalSearchDraft = ref("");

watch(
  () => [route.name, route.query.q] as const,
  () => {
    if (route.name !== "search") {
      globalSearchDraft.value = "";
      return;
    }
    const raw = route.query.q;
    const s =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw) && raw.length > 0 && raw[0] != null
          ? String(raw[0])
          : "";
    globalSearchDraft.value = s;
  },
  { immediate: true },
);

function submitGlobalSearch() {
  const t = globalSearchDraft.value.trim();
  void router.push({ path: "/search", query: t ? { q: t } : {} });
}

function syncTabFromRoute() {
  if (!isChannelShellRoute()) {
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
  () => [route.path, route.name, route.query.parentId, route.query.categoryId, categories.value],
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

function goFavorites() {
  void router.push({ name: "favorites" });
}

function goEditor() {
  void router.push({ name: "editor-new" });
}

function goWriteArticle() {
  if (auth.isLoggedIn) {
    goEditor();
    return;
  }
  void router.push({ name: "login", query: { redirect: "/mine/editor" } });
}

function goLogin() {
  void router.push({ name: "login", query: { redirect: route.fullPath } });
}

function goRegister() {
  void router.push({ name: "register" });
}

function goProfile() {
  void router.push({ name: "profile" });
}

function avatarInitial(): string {
  const n = displayName.value.trim();
  return n ? n.slice(0, 1).toUpperCase() : "用";
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
        <div class="top-left">
          <RouterLink class="logo" :to="{ path: '/', query: {} }">码笺</RouterLink>
          <nav v-if="isChannelShellRoute()" class="channel-nav" aria-label="频道">
            <button
              type="button"
              class="channel-nav__item"
              :class="{ 'is-active': activeChannel === 'all' }"
              @click="onChannelSelect('all')"
            >
              首页
            </button>
            <button
              v-for="c in categories"
              :key="c.id"
              type="button"
              class="channel-nav__item"
              :class="{ 'is-active': activeChannel === `p-${c.id}` }"
              @click="onChannelSelect(`p-${c.id}`)"
            >
              {{ c.name }}
            </button>
          </nav>
        </div>

        <div class="top-gap" aria-hidden="true" />

        <form class="top-search" @submit.prevent="submitGlobalSearch">
          <label class="search">
            <input
              v-model="globalSearchDraft"
              class="search__input"
              type="search"
              placeholder="搜索"
              autocomplete="off"
              aria-label="搜索"
              maxlength="200"
              enterkeyhint="search"
            />
            <button type="submit" class="search__ico" aria-label="搜索">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" fill="none" stroke="#969696" stroke-width="2" />
                <path stroke="#969696" stroke-width="2" stroke-linecap="round" d="M16 16l4 4" />
              </svg>
            </button>
          </label>
        </form>

        <div class="top-gap" aria-hidden="true" />

        <nav class="actions" aria-label="站点与账户">
          <template v-if="isLoggedIn">
            <button type="button" class="btn-write" @click="goEditor">
              <span class="btn-write__pen" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path
                    fill="currentColor"
                    d="M4 20.5L4.5 17l10-10 3 3-10 10L4 20.5zm12.2-11.7l-1-1 1.8-1.8a1 1 0 0 1 1.4 0l.6.6a1 1 0 0 1 0 1.4l-1.8 1.8-1-1z"
                  />
                </svg>
              </span>
              <span>写文章</span>
            </button>
            <button type="button" class="action-link" @click="goMine">我的文章</button>
            <button type="button" class="action-link" @click="goFavorites">我的收藏</button>
            <span class="actions__divider" aria-hidden="true" />
            <div class="actions__user">
              <button
                type="button"
                class="actions__avatar"
                aria-label="个人资料"
                @click="goProfile"
              >
                <img
                  v-if="profile?.avatar"
                  :src="profile.avatar"
                  alt=""
                  class="actions__avatar-img"
                />
                <span v-else class="actions__avatar-placeholder">{{ avatarInitial() }}</span>
              </button>
              <span class="hello" :title="displayName || undefined">
                你好，<span class="hello__name">{{ displayName || "用户" }}</span>
              </span>
              <button type="button" class="action-link" @click="goProfile">个人资料</button>
              <button type="button" class="action-link action-link--subtle" @click="onLogout">
                退出
              </button>
            </div>
          </template>
          <template v-else>
            <button type="button" class="action-link action-link--login" @click="goLogin">
              登录
            </button>
            <button type="button" class="btn-register" @click="goRegister">注册</button>
            <button type="button" class="btn-write" @click="goWriteArticle">
              <span class="btn-write__pen" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path
                    fill="currentColor"
                    d="M4 20.5L4.5 17l10-10 3 3-10 10L4 20.5zm12.2-11.7l-1-1 1.8-1.8a1 1 0 0 1 1.4 0l.6.6a1 1 0 0 1 0 1.4l-1.8 1.8-1-1z"
                  />
                </svg>
              </span>
              <span>写文章</span>
            </button>
          </template>
        </nav>
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
  box-sizing: border-box;
  display: flex;
  align-items: center;
  max-width: 1200px;
  min-height: 58px;
  padding: 0 24px;
  margin: 0 auto;
}

.top-left {
  display: flex;
  flex: 0 1 auto;
  gap: 4px;
  align-items: center;
  min-width: 0;
}

.logo {
  flex-shrink: 0;
  margin-right: 14px;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 24px;
  font-weight: bolder;
  line-height: 1;
  color: #ea6f5a;
  letter-spacing: 0.02em;
  white-space: nowrap;
  text-decoration: none;
}

.channel-nav {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: nowrap;
  gap: 0;
  align-items: center;
  min-width: 0;
}

.channel-nav__item {
  box-sizing: border-box;
  flex-shrink: 0;
  padding: 0 18px;
  margin: 0;
  font-family: inherit;
  font-size: 17px;
  font-weight: 400;
  line-height: 58px;
  color: #333;
  text-align: center;
  letter-spacing: 0.02em;
  text-decoration: none;
  cursor: pointer;
  outline: none;
  background: transparent;
  border: none;
  border-radius: 0;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;

  &:hover {
    color: #ea6f5a;
    background-color: rgb(0 0 0 / 0.02);
  }

  &.is-active {
    font-weight: 600;
    color: #ea6f5a;
    background-color: transparent;
  }

  &:focus-visible {
    outline: 2px solid rgb(234 111 90 / 0.45);
    outline-offset: 2px;
    border-radius: 6px;
  }
}

.top-gap {
  flex: 1 1 0;
  min-width: 16px;
}

.top-search {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  justify-content: center;
  max-width: min(420px, 36vw);
  padding: 0;
  margin: 0;
  border: none;
}

.search {
  position: relative;
  display: block;
  width: 100%;
}

.search__input {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-width: 200px;
  height: 38px;
  padding: 0 40px 0 16px;
  margin: 0;
  font: inherit;
  font-size: 14px;
  color: #333;
  outline: none;
  background: #f3f3f3;
  border: 1px solid transparent;
  border-radius: 999px;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &::placeholder {
    color: #9a9a9a;
  }

  &:hover {
    background: #eee;
  }

  &:focus {
    background: #fff;
    border-color: rgb(234 111 90 / 0.4);
    box-shadow: 0 0 0 3px rgb(234 111 90 / 0.12);
  }
}

.search__ico {
  position: absolute;
  top: 50%;
  right: 12px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  margin: 0;
  appearance: none;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 4px;
  transform: translateY(-50%);

  &:focus-visible {
    outline: 2px solid rgb(234 111 90 / 0.55);
    outline-offset: 2px;
  }
}

.actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: center;
  white-space: nowrap;
}

.actions__divider {
  flex-shrink: 0;
  width: 1px;
  height: 14px;
  margin: 0 2px;
  background: #e5e5e5;
}

.actions__user {
  display: flex;
  flex-shrink: 0;
  gap: 10px;
  align-items: center;
  max-width: min(280px, 36vw);
}

.actions__avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  background: #f0f0f0;
  border: 1px solid #e8e8e8;
  border-radius: 50%;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;

  &:hover {
    border-color: #ea6f5a;
    box-shadow: 0 0 0 1px rgb(234 111 90 / 0.25);
  }

  &:focus-visible {
    outline: 2px solid rgb(234 111 90 / 0.45);
    outline-offset: 1px;
  }
}

.actions__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.actions__avatar-placeholder {
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  color: #888;
}

.action-link {
  padding: 6px 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.25;
  color: #404040;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  transition:
    color 0.18s ease,
    background-color 0.18s ease;

  &:hover {
    color: #ea6f5a;
    background-color: rgb(0 0 0 / 0.03);
  }

  &:focus-visible {
    outline: 2px solid rgb(234 111 90 / 0.45);
    outline-offset: 1px;
  }
}

.action-link--subtle {
  color: #888;

  &:hover {
    color: #ea6f5a;
  }
}

.action-link--login {
  padding-right: 6px;
}

.btn-register {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  padding: 6px 18px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  color: #ea6f5a;
  white-space: nowrap;
  cursor: pointer;
  background: #fff;
  border: 1px solid #ea6f5a;
  border-radius: 999px;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    background: rgb(234 111 90 / 0.08);
  }

  &:focus-visible {
    outline: 2px solid rgb(234 111 90 / 0.45);
    outline-offset: 2px;
  }
}

.btn-write {
  box-sizing: border-box;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  height: 38px;
  padding: 0 20px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  color: #fff;
  white-space: nowrap;
  cursor: pointer;
  background: #ea6f5a;
  border: none;
  border-radius: 999px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    background: #e25b46;
    box-shadow: 0 2px 6px rgb(234 111 90 / 0.28);
  }

  &:focus-visible {
    outline: 2px solid rgb(234 111 90 / 0.55);
    outline-offset: 2px;
  }
}

.btn-write__pen {
  display: inline-flex;
  line-height: 0;
  opacity: 0.95;
}

.hello {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 1.3;
  color: #888;
  white-space: nowrap;
}

.hello__name {
  font-weight: 500;
  color: #333;
}

.main {
  max-width: 1000px;
  padding: 24px 16px 48px;
  margin: 0 auto;
}
</style>
