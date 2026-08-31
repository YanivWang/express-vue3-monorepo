<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";

import PostFeedBoard from "@/components/PostFeedBoard.vue";

import HomeSecondarySidebar from "./home/components/HomeSecondarySidebar.vue";
import HomeSortTabs from "./home/components/HomeSortTabs.vue";
import { useHomeCategoryNav } from "./home/composables/useHomeCategoryNav";
import { useHomeFeed } from "./home/composables/useHomeFeed";

const route = useRoute();
const router = useRouter();

const {
  parentId,
  leafCategoryId,
  resolvedParentId,
  secondaryList,
  showSecondarySidebar,
  isAllSecondaryActive,
} = useHomeCategoryNav();

const { posts, pagination, page, loading, feedSort } = useHomeFeed({ parentId, leafCategoryId });

// 带上当前 query 进详情，从详情返回时列表还停在原来的分类与排序上
function goPost(id: number) {
  void router.push({
    name: "post-detail",
    params: { id: String(id) },
    query: { ...route.query },
  });
}
</script>

<template>
  <div class="home" :class="{ 'home--with-side': showSecondarySidebar }">
    <HomeSecondarySidebar
      v-if="showSecondarySidebar"
      :parent-id="resolvedParentId"
      :items="secondaryList"
      :all-active="isAllSecondaryActive"
      :active-leaf-id="leafCategoryId"
    />

    <div class="feed-wrap">
      <PostFeedBoard
        :posts="posts"
        :loading="loading"
        :pagination="pagination"
        :feed-page="page"
        empty-description="暂无文章"
        @select-post="goPost"
        @page-change="(pn: number) => (page = pn)"
      >
        <template #toolbar>
          <HomeSortTabs :sort="feedSort" />
        </template>
      </PostFeedBoard>
    </div>
  </div>
</template>

<style scoped lang="scss">
.home {
  display: block;
}

.home--with-side {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.feed-wrap {
  flex: 1 1 0;
  min-width: 0;
}
</style>
