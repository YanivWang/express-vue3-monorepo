<script setup lang="ts">
import { ChatDotRound, Collection, StarFilled } from "@element-plus/icons-vue";

import type { Pagination, PostItem } from "@/api/types";
import { authorInitial, cardAbstract, cardCoverUrl, formatFeedTime } from "@/utils/postFeed";

function displayStat(n: number | undefined) {
  const v = Math.max(0, n ?? 0);
  if (v > 99999) return "99999+";
  return String(v);
}

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

function onCardClick(ev: MouseEvent, id: number) {
  if ((ev.target as HTMLElement).closest("a")) return;
  emit("select-post", id);
}
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
      <article
        v-for="p in posts"
        :key="p.id"
        class="feed-card"
        role="link"
        tabindex="0"
        @click="onCardClick($event, p.id)"
        @keydown.enter="emit('select-post', p.id)"
      >
        <div class="feed-card__inner">
          <div class="feed-card__main">
            <h2 class="feed-card__title">{{ p.title }}</h2>
            <p class="feed-card__abstract">{{ cardAbstract(p) }}</p>
            <div class="feed-card__meta">
              <el-avatar class="feed-card__avatar" :size="22" :src="p.author?.avatar ?? undefined">
                {{ authorInitial(p) }}
              </el-avatar>
              <span class="feed-card__author">{{ p.author?.username ?? "—" }}</span>
              <span class="feed-card__dot">·</span>
              <time class="feed-card__time" :datetime="p.createdAt">{{
                formatFeedTime(p.createdAt)
              }}</time>
              <span class="feed-card__dot">·</span>
              <span class="feed-card__cat">{{ p.category?.name ?? "未分类" }}</span>
            </div>
            <div class="feed-card__stats" aria-label="互动数据">
              <span class="feed-card__stat" title="评论数">
                <el-icon class="feed-card__stat-ico"><ChatDotRound /></el-icon>
                {{ displayStat(p.commentCount) }}
              </span>
              <span class="feed-card__stat" title="收藏数">
                <el-icon class="feed-card__stat-ico"><Collection /></el-icon>
                {{ displayStat(p.favoriteCount) }}
              </span>
              <span class="feed-card__stat" title="点赞数">
                <el-icon class="feed-card__stat-ico"><StarFilled /></el-icon>
                {{ displayStat(p.likeCount) }}
              </span>
            </div>
          </div>
          <div v-if="cardCoverUrl(p)" class="feed-card__thumb-wrap">
            <img class="feed-card__thumb" :src="cardCoverUrl(p)!" alt="" loading="lazy" />
          </div>
        </div>
      </article>
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
$brand: #ea6f5a;
$text: #333;
$muted: #969696;
$line: #f0f0f0;

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

.pager {
  display: flex;
  justify-content: center;
  margin-top: 28px;
}
</style>
