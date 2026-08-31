<script setup lang="ts">
import type { Pagination, PostItem } from "@/api/types";

import PostFeedCard from "./post-feed/PostFeedCard.vue";

withDefaults(
  defineProps<{
    posts: PostItem[];
    loading: boolean;
    pagination: Pagination | null;
    /** 与当前请求的页码一致，避免分页器在响应返回前短暂错位 */
    feedPage: number;
    emptyDescription?: string;
  }>(),
  { emptyDescription: "暂无文章" },
);

const emit = defineEmits<{
  "select-post": [id: number];
  "page-change": [page: number];
}>();
</script>

<template>
  <div v-loading="loading" class="feed-wrap">
    <div class="feed-board">
      <div v-if="$slots.toolbar" class="feed-board__toolbar">
        <slot name="toolbar" />
      </div>
      <el-empty
        v-if="!loading && posts.length === 0"
        class="feed-empty"
        :description="emptyDescription"
      />
      <PostFeedCard v-for="p in posts" :key="p.id" :post="p" @select="emit('select-post', p.id)" />
    </div>

    <div v-if="pagination && pagination.totalPages > 1" class="pager">
      <el-pagination
        :current-page="feedPage"
        :page-size="pagination.limit"
        :total="pagination.total"
        layout="prev, pager, next"
        background
        @current-change="(pn: number) => emit('page-change', pn)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "./post-feed/styles/tokens" as *;

.feed-wrap {
  flex: 1 1 0;
  min-width: 0;
}

.feed-board {
  min-height: 240px;
  overflow: hidden;
  background: #fff;
  border: 1px solid rgb(0 0 0 / 4%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 3%);
}

.feed-board__toolbar {
  padding: 14px 20px;
  border-bottom: 1px solid $line;
}

.feed-empty {
  padding: 48px 24px;
}

.pager {
  display: flex;
  justify-content: center;
  margin-top: 28px;
}
</style>
