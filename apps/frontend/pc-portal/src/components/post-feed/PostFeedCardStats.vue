<script setup lang="ts">
import { ChatDotRound, Collection, StarFilled } from "@element-plus/icons-vue";

import type { PostItem } from "@/api/types";
import { displayStat } from "@/utils/postFeed";

defineProps<{ post: PostItem }>();
</script>

<template>
  <div class="feed-card__stats" aria-label="互动数据">
    <span class="feed-card__stat" title="评论数">
      <el-icon class="feed-card__stat-ico"><ChatDotRound /></el-icon>
      {{ displayStat(post.commentCount) }}
    </span>
    <span class="feed-card__stat" title="收藏数">
      <el-icon class="feed-card__stat-ico"><Collection /></el-icon>
      {{ displayStat(post.favoriteCount) }}
    </span>
    <span class="feed-card__stat" title="点赞数">
      <el-icon class="feed-card__stat-ico"><StarFilled /></el-icon>
      {{ displayStat(post.likeCount) }}
    </span>
  </div>
</template>

<style scoped lang="scss">
@use "./styles/tokens" as *;

.feed-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.4;
  color: $muted;
}

.feed-card__stat {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.feed-card__stat-ico {
  font-size: 14px;
}
</style>
