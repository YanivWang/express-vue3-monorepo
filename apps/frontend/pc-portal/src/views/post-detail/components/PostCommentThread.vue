<script setup lang="ts">
import type { CommentReplyItem, CommentThreadItem } from "@/api/types";

import { formatCommentTime } from "../formatters";

import PostInlineReplyComposer from "./PostInlineReplyComposer.vue";

const props = defineProps<{
  thread: CommentThreadItem;
  isLoggedIn: boolean;
  /** 当前展开内联输入框的评论 id；同一时刻只允许一个 */
  activeInlineTargetId: number | null;
  inlineDraft: string;
  /** 删除权限逐条判定（本人 / 文章作者 / 管理员），由上层注入 */
  canDeleteComment: (comment: CommentReplyItem) => boolean;
}>();

defineEmits<{
  "update:inlineDraft": [value: string];
  startReply: [comment: CommentReplyItem];
  cancelReply: [];
  submitReply: [];
  deleteComment: [id: number];
}>();

/**
 * 回复链「A ▸ B」只在回复对象不是楼主评时展示——
 * 直接回复主评的那一层，用户名已经在楼层标题里了，再画一次是噪声。
 */
function showReplyChain(reply: CommentReplyItem) {
  return reply.parentId !== props.thread.id && Boolean(reply.replyToUser?.username);
}
</script>

<template>
  <div class="thread">
    <el-avatar class="c-avatar" :size="40" :src="thread.author?.avatar ?? undefined">
      {{ (thread.author?.username ?? "?").slice(0, 1) }}
    </el-avatar>
    <div class="c-main">
      <div class="c-head">
        <strong class="c-user">{{ thread.author?.username }}</strong>
        <span class="c-time">{{ formatCommentTime(thread.createdAt) }}</span>
        <div class="c-actions">
          <el-button
            v-if="isLoggedIn"
            link
            type="primary"
            size="small"
            @click="$emit('startReply', thread)"
          >
            回复
          </el-button>
          <el-button
            v-if="canDeleteComment(thread)"
            link
            type="danger"
            size="small"
            @click="$emit('deleteComment', thread.id)"
          >
            删除
          </el-button>
        </div>
      </div>
      <p class="c-body">{{ thread.content }}</p>

      <PostInlineReplyComposer
        v-if="isLoggedIn && activeInlineTargetId === thread.id"
        :model-value="inlineDraft"
        :reply-to-name="thread.author?.username ?? ''"
        @update:model-value="$emit('update:inlineDraft', $event)"
        @cancel="$emit('cancelReply')"
        @submit="$emit('submitReply')"
      />

      <div class="replies-wrap">
        <div v-for="r in thread.replies ?? []" :key="r.id" class="reply">
          <el-avatar class="c-avatar c-avatar--sm" :size="32" :src="r.author?.avatar ?? undefined">
            {{ (r.author?.username ?? "?").slice(0, 1) }}
          </el-avatar>
          <div class="c-main">
            <div class="c-head c-head--reply">
              <template v-if="showReplyChain(r)">
                <span class="c-reply-chain">
                  <strong class="c-user">{{ r.author?.username }}</strong>
                  <span class="c-chain-sep"> ▸ </span>
                  <span class="c-reply-to">{{ r.replyToUser?.username }}</span>
                </span>
              </template>
              <template v-else>
                <strong class="c-user">{{ r.author?.username }}</strong>
              </template>
              <span class="c-time">{{ formatCommentTime(r.createdAt) }}</span>
              <div class="c-actions">
                <el-button
                  v-if="isLoggedIn"
                  link
                  type="primary"
                  size="small"
                  @click="$emit('startReply', r)"
                >
                  回复
                </el-button>
                <el-button
                  v-if="canDeleteComment(r)"
                  link
                  type="danger"
                  size="small"
                  @click="$emit('deleteComment', r.id)"
                >
                  删除
                </el-button>
              </div>
            </div>
            <p class="c-body">{{ r.content }}</p>

            <PostInlineReplyComposer
              v-if="isLoggedIn && activeInlineTargetId === r.id"
              nested
              :model-value="inlineDraft"
              :reply-to-name="r.author?.username ?? ''"
              @update:model-value="$emit('update:inlineDraft', $event)"
              @cancel="$emit('cancelReply')"
              @submit="$emit('submitReply')"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.thread {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 20px 0;
  border-bottom: 1px solid $line;

  &:last-child {
    border-bottom: none;
  }
}

.c-avatar {
  flex-shrink: 0;
}

.c-avatar--sm {
  margin-top: 2px;
}

.c-main {
  flex: 1;
  min-width: 0;
}

.c-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.c-head--reply {
  align-items: flex-start;
}

.c-user {
  font-weight: 600;
  color: $text;
}

.c-time {
  flex: 1;
  min-width: 100px;
  color: $muted;
}

.c-actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
}

.c-body {
  margin: 0;
  font-size: 15px;
  line-height: 1.7;
  color: #404040;
}

.c-reply-chain {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  align-items: center;
  max-width: 100%;
  font-size: 13px;
}

.c-chain-sep {
  font-weight: 400;
  color: $muted;
}

.c-reply-to {
  font-weight: 600;
  color: $text;
}

.replies-wrap {
  margin-top: 4px;
}

.reply {
  display: flex;
  gap: 10px;
  padding: 12px 0 0 4px;
  margin-top: 12px;
  border-top: 1px solid #f5f5f5;
}
</style>
