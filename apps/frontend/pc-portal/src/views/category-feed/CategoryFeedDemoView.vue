<script setup lang="ts">
/**
 * 分类 + 列表 Feed 演示页：顶栏一级入口、左侧子分类、右侧文章列表与分页。
 * 数据来自 demo-data，接入后端时可在 composable 中替换数据源。
 */

import CategoryFeedHeader from "./components/CategoryFeedHeader.vue";
import CategoryFeedSidebar from "./components/CategoryFeedSidebar.vue";
import PostListPagination from "./components/PostListPagination.vue";
import PostSummaryCard from "./components/PostSummaryCard.vue";
import { useCategoryFeedDemo } from "./composables/useCategoryFeedDemo";

const {
  activePrimary,
  activeSecondarySlug,
  page,
  primaryLabels,
  currentSecondaries,
  pagedPosts,
  totalPages,
  selectPrimary,
  selectSecondary,
  goPage,
} = useCategoryFeedDemo();
</script>

<template>
  <div class="cf">
    <CategoryFeedHeader
      :active-primary="activePrimary"
      :primary-labels="primaryLabels"
      @select-primary="selectPrimary"
    />

    <div class="cf__body">
      <div class="cf__container">
        <CategoryFeedSidebar
          :items="currentSecondaries"
          :active-slug="activeSecondarySlug"
          @select-secondary="selectSecondary"
        />

        <main class="cf__main">
          <template v-if="activePrimary !== 'tech'">
            <div class="cf__main-placeholder">
              <p class="cf__main-placeholder-text">
                当前为「{{
                  primaryLabels[activePrimary]
                }}」入口的演示占位：左侧子分类仅在「技术」下展示。请切换到「技术」后选择子栏目，右侧将按分页展示文章列表。
              </p>
            </div>
          </template>
          <template v-else>
            <PostSummaryCard v-for="row in pagedPosts" :key="row.id" :row="row" />
            <PostListPagination :page="page" :total-pages="totalPages" @go-page="goPage" />
          </template>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "./styles/tokens" as *;

.cf {
  min-height: 100vh;
  font-family: $cf-font-stack;
  color: $cf-text;
  background: #ffffff;
  -webkit-font-smoothing: antialiased;
}

.cf__body {
  padding: 30px 0 48px;
  background: #ffffff;
}

.cf__container {
  box-sizing: border-box;
  display: flex;
  gap: $cf-gap;
  align-items: flex-start;
  max-width: $cf-container;
  padding: 0 15px;
  margin: 0 auto;
}

.cf__main-placeholder {
  box-sizing: border-box;
  padding: 24px 20px;
  background: #fafafa;
  border: 1px dashed $cf-border;
  border-radius: 4px;
}

.cf__main-placeholder-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  color: $cf-muted;
}

.cf__main {
  flex: 1 1 0;
  min-width: 0;
  padding-top: 2px;
}
</style>
