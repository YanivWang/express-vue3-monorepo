<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import AppShellAccountNav from "@/components/app-shell/AppShellAccountNav.vue";
import AppShellChannelNav from "@/components/app-shell/AppShellChannelNav.vue";
import AppShellSearch from "@/components/app-shell/AppShellSearch.vue";
import { useChannelNav } from "@/components/app-shell/composables/useChannelNav";
import { useGlobalSearch } from "@/components/app-shell/composables/useGlobalSearch";
import { useAuthStore } from "@/stores/auth";

/**
 * 全站外壳：顶栏 + 内容插槽。
 *
 * 频道导航与全站搜索各自成 composable，顶栏的三块各自成组件，
 * 这里只剩「谁跳去哪」和外壳自身的布局。
 */

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { isLoggedIn, displayName, profile } = storeToRefs(auth);

const { categories, activeChannel, isChannelShellRoute, loadCategories, onChannelSelect } =
  useChannelNav();
const search = useGlobalSearch();

onMounted(loadCategories);

function goMine() {
  void router.push({ name: "mine" });
}

function goFavorites() {
  void router.push({ name: "favorites" });
}

function goProfile() {
  void router.push({ name: "profile" });
}

function goRegister() {
  void router.push({ name: "register" });
}

function goLogin() {
  void router.push({ name: "login", query: { redirect: route.fullPath } });
}

/** 未登录时先去登录，登录后回到编辑页 */
function goWriteArticle() {
  if (auth.isLoggedIn) {
    void router.push({ name: "editor-new" });
    return;
  }
  void router.push({ name: "login", query: { redirect: "/mine/editor" } });
}

async function onLogout() {
  await auth.logout();
  void router.push({ name: "home" });
}
</script>

<template>
  <div class="app-shell">
    <header class="top">
      <div class="top-inner">
        <div class="top-left">
          <RouterLink class="logo" :to="{ path: '/', query: {} }">码笺</RouterLink>
          <AppShellChannelNav
            v-if="isChannelShellRoute()"
            :categories="categories"
            :active="activeChannel"
            @select="onChannelSelect"
          />
        </div>

        <div class="top-gap" aria-hidden="true" />

        <AppShellSearch v-model="search.draft.value" @submit="search.submit" />

        <div class="top-gap" aria-hidden="true" />

        <AppShellAccountNav
          :is-logged-in="isLoggedIn"
          :display-name="displayName"
          :avatar="profile?.avatar ?? null"
          @write="goWriteArticle"
          @mine="goMine"
          @favorites="goFavorites"
          @profile="goProfile"
          @logout="onLogout"
          @login="goLogin"
          @register="goRegister"
        />
      </div>
    </header>
    <main
      class="main"
      :class="{
        'main--detail': route.name === 'post-detail',
        'main--auth': route.name === 'login' || route.name === 'register',
      }"
    >
      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
@use "@/components/app-shell/styles/tokens" as *;

.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  color: $text;
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
  max-width: 1030px;
  min-height: 58px;
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
  color: $brand;
  letter-spacing: 0.02em;
  white-space: nowrap;
  text-decoration: none;
}

/** 撑开 logo/导航、搜索、账户区三段之间的空隙 */
.top-gap {
  flex: 1 1 0;
  min-width: 16px;
}

.main {
  box-sizing: border-box;
  width: 100%;
  max-width: 1030px;
  padding: 24px 16px 48px;
  padding-top: 16px;
  padding-right: 0;
  padding-left: 0;
  margin: 0 auto;

  &--detail {
    max-width: 1030px;
  }

  &--auth {
    flex-direction: column;
    padding-top: 100px;
    padding-bottom: 24px;
  }
}
</style>
