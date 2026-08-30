<script setup lang="ts">
import type { CommentReplyItem, CommentThreadItem } from "@/api/types";

import PostCommentThread from "./PostCommentThread.vue";

import type { CommentPagination } from "../composables/usePostComments";

defineProps<{
  /** 已按当前排序排好的主评列表 */
  threads: CommentThreadItem[];
  loading: boolean;
  isLoggedIn: boolean;
  sort: "desc" | "asc";
  page: number;
  pagination: CommentPagination | null;
  /** 分页尚未返回时的兜底总数，取自文章上的 commentCount */
  fallbackTotal: number;
  newComment: string;
  activeInlineTargetId: number | null;
  inlineDraft: string;
  canDeleteComment: (comment: CommentReplyItem) => boolean;
}>();

defineEmits<{
  "update:sort": [value: "desc" | "asc"];
  "update:page": [value: number];
  "update:newComment": [value: string];
  "update:inlineDraft": [value: string];
  submitComment: [];
  startReply: [comment: CommentReplyItem];
  cancelReply: [];
  submitReply: [];
  deleteComment: [id: number];
}>();
</script>

<template>
  <section class="comments">
    <div class="comments-hd">
      <h2 class="side-heading">
        全部评论
        <span class="count">{{
          (pagination?.commentTotal ?? fallbackTotal).toLocaleString()
        }}</span>
      </h2>
      <div class="sort-row">
        <button
          type="button"
          class="sort-btn"
          :class="{ 'sort-btn--on': sort === 'desc' }"
          @click="$emit('update:sort', 'desc')"
        >
          按时间倒序
        </button>
        <button
          type="button"
          class="sort-btn"
          :class="{ 'sort-btn--on': sort === 'asc' }"
          @click="$emit('update:sort', 'asc')"
        >
          按时间正序
        </button>
      </div>
    </div>

    <div v-if="isLoggedIn" class="composer">
      <el-input
        class="comment-input"
        type="textarea"
        :rows="4"
        maxlength="5000"
        show-word-limit
        placeholder="写下你的评论…"
        :model-value="newComment"
        @update:model-value="$emit('update:newComment', $event)"
      />
      <el-button type="primary" round class="send" @click="$emit('submitComment')">
        发布评论
      </el-button>
    </div>
    <div v-else class="login-tip">登录后可发表评论</div>

    <div v-loading="loading" class="thread-list">
      <PostCommentThread
        v-for="thread in threads"
        :key="thread.id"
        :thread="thread"
        :is-logged-in="isLoggedIn"
        :active-inline-target-id="activeInlineTargetId"
        :inline-draft="inlineDraft"
        :can-delete-comment="canDeleteComment"
        @update:inline-draft="$emit('update:inlineDraft', $event)"
        @start-reply="$emit('startReply', $event)"
        @cancel-reply="$emit('cancelReply')"
        @submit-reply="$emit('submitReply')"
        @delete-comment="$emit('deleteComment', $event)"
      />
      <el-empty v-if="!loading && threads.length === 0" description="暂无评论" />
    </div>

    <div v-if="pagination && (pagination.hasNext || page > 1)" class="pager">
      <el-pagination
        :current-page="page"
        :page-size="pagination.limit"
        :total="pagination.total"
        layout="prev, pager, next"
        background
        @current-change="(p: number) => $emit('update:page', p)"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.comments {
  padding-top: 8px;
  margin-top: 8px;
  border-top: 1px solid $line;
}

.side-heading {
  @include side-heading;
}

.comments-hd {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin: 24px 0 18px;
}

.sort-row {
  display: flex;
  gap: 4px;
}

.sort-btn {
  padding: 4px 10px;
  font-size: 13px;
  color: $muted;
  cursor: pointer;
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 999px;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;

  &:hover {
    color: $brand;
    border-color: rgb(234 111 90 / 35%);
  }
}

.sort-btn--on {
  color: #fff;
  background: $brand;
  border-color: $brand;

  &:hover {
    color: #fff;
    border-color: $brand;
  }
}

.composer {
  margin-bottom: 20px;
}

.comment-input {
  @include comment-input;
}

.send {
  @include brand-send-button;

  padding-right: 22px;
  padding-left: 22px;
  margin-top: 12px;
}

.login-tip {
  margin-bottom: 16px;
  font-size: 14px;
  color: $muted;
}

.thread-list {
  min-height: 80px;
}

.pager {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>
