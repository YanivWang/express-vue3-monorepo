<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import CategoryFeedHeaderActions from "./CategoryFeedHeaderActions.vue";
import CategoryFeedNav from "./CategoryFeedNav.vue";
import CategoryFeedSearch from "./CategoryFeedSearch.vue";

import type { PrimaryKey } from "../types";

/** 分类内容流的顶栏：logo + 一级导航 + 搜索 + 右侧入口 */

defineProps<{
  activePrimary: PrimaryKey;
  primaryLabels: Record<PrimaryKey, string>;
}>();

const emit = defineEmits<{
  selectPrimary: [key: PrimaryKey];
}>();

const router = useRouter();
const searchDraft = ref("");

function submitSearch() {
  const t = searchDraft.value.trim();
  void router.push({ path: "/search", query: t ? { q: t } : {} });
}
</script>

<template>
  <header class="cf__header">
    <div class="cf__header-inner">
      <div class="cf__header-left">
        <RouterLink class="cf__logo" :to="{ path: '/' }">码笺</RouterLink>
        <CategoryFeedNav
          :active-primary="activePrimary"
          :primary-labels="primaryLabels"
          @select="emit('selectPrimary', $event)"
        />
      </div>

      <div class="cf__header-flex" aria-hidden="true" />

      <CategoryFeedSearch v-model="searchDraft" @submit="submitSearch" />

      <div class="cf__header-flex" aria-hidden="true" />

      <CategoryFeedHeaderActions />
    </div>
  </header>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.cf__header {
  position: sticky;
  top: 0;
  z-index: 1000;
  height: $cf-header-h;
  background: #fff;
  border-bottom: 1px solid $cf-border;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 2%);
}

.cf__header-inner {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  max-width: $cf-container;
  height: 100%;
  padding: 0 15px;
  margin: 0 auto;
}

.cf__header-left {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
}

/** 撑开 logo/导航、搜索、右侧入口三段之间的空隙 */
.cf__header-flex {
  flex: 1 1 0;
  min-width: 16px;
}

.cf__logo {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  margin-right: 14px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  color: $cf-primary;
  letter-spacing: 0.02em;
  white-space: nowrap;
  text-decoration: none;
}
</style>
