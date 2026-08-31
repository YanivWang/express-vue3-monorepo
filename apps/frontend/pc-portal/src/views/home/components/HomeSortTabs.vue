<script setup lang="ts">
import { useRoute } from "vue-router";

import { mergedQuery } from "../query";

defineProps<{ sort: "latest" | "hot" }>();

// 「最新」是默认排序，因此它对应的是「删掉 sort 键」而不是 sort=latest，
// 这样默认状态下 URL 保持干净、分享出去也不会带上冗余参数
const route = useRoute();
</script>

<template>
  <div class="home-sort" role="tablist" aria-label="列表排序">
    <RouterLink
      class="home-sort__link"
      :class="{ 'home-sort__link--active': sort === 'latest' }"
      :to="{ path: '/', query: mergedQuery(route.query, { sort: undefined }) }"
    >
      最新
    </RouterLink>
    <RouterLink
      class="home-sort__link"
      :class="{ 'home-sort__link--active': sort === 'hot' }"
      :to="{ path: '/', query: mergedQuery(route.query, { sort: 'hot' }) }"
    >
      热门
    </RouterLink>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.home-sort {
  display: flex;
  gap: 10px;
}

.home-sort__link {
  padding: 6px 16px;
  font-size: 14px;
  color: #666;
  text-decoration: none;
  background: #fafafa;
  border: 1px solid rgb(0 0 0 / 6%);
  border-radius: 20px;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    color: $brand;
    border-color: rgb(234 111 90 / 35%);
  }
}

.home-sort__link--active {
  font-weight: 600;
  color: $brand;
  background: rgb(234 111 90 / 8%);
  border-color: rgb(234 111 90 / 45%);
}
</style>
