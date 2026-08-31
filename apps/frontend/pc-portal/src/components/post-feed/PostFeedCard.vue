<script setup lang="ts">
import type { PostItem } from "@/api/types";
import { authorInitial, cardAbstract, cardCoverUrl, formatFeedTime } from "@/utils/postFeed";

import PostFeedCardStats from "./PostFeedCardStats.vue";

defineProps<{ post: PostItem }>();

const emit = defineEmits<{ select: [] }>();

/**
 * 整张卡片可点，但卡片内的链接要让位：
 * 摘要与正文将来可能内嵌链接，若不排除，点链接会同时把人带去文章详情。
 */
function onCardClick(ev: MouseEvent) {
  if ((ev.target as HTMLElement).closest("a")) return;
  emit("select");
}
</script>

<template>
  <article
    class="feed-card"
    role="link"
    tabindex="0"
    @click="onCardClick"
    @keydown.enter="emit('select')"
  >
    <div class="feed-card__inner">
      <div class="feed-card__main">
        <h2 class="feed-card__title">{{ post.title }}</h2>
        <p class="feed-card__abstract">{{ cardAbstract(post) }}</p>
        <div class="feed-card__meta">
          <el-avatar class="feed-card__avatar" :size="22" :src="post.author?.avatar ?? undefined">
            {{ authorInitial(post) }}
          </el-avatar>
          <span class="feed-card__author">{{ post.author?.username ?? "—" }}</span>
          <span class="feed-card__dot">·</span>
          <time class="feed-card__time" :datetime="post.createdAt">{{
            formatFeedTime(post.createdAt)
          }}</time>
          <span class="feed-card__dot">·</span>
          <span class="feed-card__cat">{{ post.category?.name ?? "未分类" }}</span>
        </div>
        <PostFeedCardStats :post="post" />
      </div>
      <div v-if="cardCoverUrl(post)" class="feed-card__thumb-wrap">
        <img class="feed-card__thumb" :src="cardCoverUrl(post)!" alt="" loading="lazy" />
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use "./styles/tokens" as *;

.feed-card {
  margin: 0;
  cursor: pointer;
  outline: none;
  border-bottom: 1px solid $line;
  transition: background 0.15s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #f9f9f9;

    .feed-card__title {
      color: $brand;
    }

    .feed-card__thumb {
      transform: scale(1.02);
    }
  }

  &:focus-visible {
    background: #fafafa;
    box-shadow: inset 0 0 0 2px rgb(234 111 90 / 35%);
  }
}

.feed-card__inner {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 22px 26px 20px;

  @media (width <= 640px) {
    flex-direction: column-reverse;
    gap: 14px;
    padding: 18px 16px 16px;
  }
}

.feed-card__main {
  flex: 1 1 0;
  min-width: 0;
}

.feed-card__title {
  display: -webkit-box;
  margin: 0 0 10px;
  overflow: hidden;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
  color: $text;
  transition: color 0.15s ease;
  -webkit-box-orient: vertical;
}

.feed-card__abstract {
  display: -webkit-box;
  min-height: calc(1.75em * 3);
  max-height: none;
  margin: 0 0 14px;
  overflow: hidden;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  font-size: 13px;
  line-height: 1.75;
  color: $muted;
  -webkit-box-orient: vertical;
}

.feed-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 0;
  align-items: center;
  font-size: 12px;
  line-height: 1.5;
  color: $muted;
}

.feed-card__avatar {
  flex-shrink: 0;
  margin-right: 6px;
}

.feed-card__author {
  color: #5a5a5a;
}

.feed-card__dot {
  margin: 0 5px;
  color: #d8d8d8;
}

.feed-card__time {
  color: $muted;
}

.feed-card__cat {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-card__thumb-wrap {
  flex-shrink: 0;
  width: 148px;
  height: 98px;
  overflow: hidden;
  border: 1px solid rgb(0 0 0 / 6%);
  border-radius: 6px;

  @media (width <= 640px) {
    width: 100%;
    height: 160px;
  }
}

.feed-card__thumb {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.25s ease;
}
</style>
