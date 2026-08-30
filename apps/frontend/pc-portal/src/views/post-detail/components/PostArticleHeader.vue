<script setup lang="ts">
import { computed } from "vue";

import type { PostItem } from "@/api/types";

import { authorInitial, countPostWords, formatDetailTime } from "../formatters";

const props = defineProps<{
  post: PostItem;
  canEdit: boolean;
  interactionLoading: boolean;
}>();

defineEmits<{
  back: [];
  edit: [];
  remove: [];
  vote: [kind: "like" | "dislike"];
  toggleFavorite: [];
}>();

const initial = computed(() => authorInitial(props.post));
const wordCount = computed(() => countPostWords(props.post));
</script>

<template>
  <div class="toolbar">
    <button type="button" class="linkish" @click="$emit('back')">← 返回列表</button>
    <div v-if="canEdit" class="owner-tools">
      <el-button type="primary" link @click="$emit('edit')">编辑</el-button>
      <el-button type="danger" link @click="$emit('remove')">删除</el-button>
    </div>
  </div>

  <h1 class="title">{{ post.title }}</h1>

  <div class="author-row">
    <el-avatar class="author-avatar" :size="48" :src="post.author?.avatar ?? undefined">
      {{ initial }}
    </el-avatar>
    <div class="author-info">
      <div class="author-name-line">
        <span class="author-name">{{ post.author?.username ?? "作者" }}</span>
      </div>
      <div class="meta-line">
        <span>{{ formatDetailTime(post.createdAt) }}</span>
        <span class="dot">·</span>
        <span>字数 {{ wordCount.toLocaleString() }}</span>
        <span class="dot">·</span>
        <span>{{ post.category?.name }}</span>
      </div>
      <div class="engage-row">
        <span class="engage-metric">阅读 {{ (post.viewCount ?? 0).toLocaleString() }}</span>
        <span class="engage-dot" aria-hidden="true">·</span>
        <span class="engage-metric">评论 {{ (post.commentCount ?? 0).toLocaleString() }}</span>
        <span class="engage-dot" aria-hidden="true">·</span>
        <span class="engage-metric">收藏 {{ (post.favoriteCount ?? 0).toLocaleString() }}</span>
        <span class="engage-dot" aria-hidden="true">·</span>
        <span class="engage-metric">赞 {{ (post.likeCount ?? 0).toLocaleString() }}</span>
        <template v-if="(post.dislikeCount ?? 0) > 0">
          <span class="engage-dot" aria-hidden="true">·</span>
          <span class="engage-metric">踩 {{ (post.dislikeCount ?? 0).toLocaleString() }}</span>
        </template>
      </div>
      <div class="engage-actions">
        <el-button
          size="small"
          round
          :type="post.myVote === 'like' ? 'primary' : 'default'"
          plain
          :loading="interactionLoading"
          @click.stop="$emit('vote', 'like')"
        >
          {{ post.myVote === "like" ? "已赞" : "点赞" }}
        </el-button>
        <el-button
          size="small"
          round
          :type="post.myVote === 'dislike' ? 'danger' : 'default'"
          plain
          :loading="interactionLoading"
          @click.stop="$emit('vote', 'dislike')"
        >
          {{ post.myVote === "dislike" ? "已踩" : "踩" }}
        </el-button>
        <el-button
          size="small"
          round
          :type="post.myFavorited ? 'warning' : 'default'"
          plain
          :loading="interactionLoading"
          @click.stop="$emit('toggleFavorite')"
        >
          {{ post.myFavorited ? "已收藏" : "收藏" }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.linkish {
  padding: 0;
  font-size: 14px;
  color: $muted;
  cursor: pointer;
  background: none;
  border: none;

  &:hover {
    color: $brand;
  }
}

.owner-tools {
  display: flex;
  gap: 4px;
}

.title {
  margin: 0 0 20px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.4;
  color: $text;

  @media (width <= 640px) {
    font-size: 22px;
  }
}

.author-row {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding-bottom: 28px;
  margin-bottom: 28px;
  border-bottom: 1px solid $line;
}

.author-avatar {
  flex-shrink: 0;
}

.author-info {
  min-width: 0;
}

.author-name-line {
  margin-bottom: 6px;
}

.author-name {
  font-size: 16px;
  font-weight: 600;
  color: $text;
}

.meta-line {
  font-size: 13px;
  line-height: 1.5;
  color: $muted;
}

.engage-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.6;
  color: $muted;
}

.engage-metric {
  color: #5c5c5c;
}

.engage-dot {
  margin: 0 4px;
  opacity: 0.65;
}

.engage-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.dot {
  margin: 0 6px;
  opacity: 0.7;
}
</style>
