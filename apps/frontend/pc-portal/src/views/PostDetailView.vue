<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { storeToRefs } from "pinia";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import * as commentsApi from "@/api/comments";
import { deletePost, fetchPostById } from "@/api/posts";
import type { CommentReplyItem, CommentThreadItem, PostItem } from "@/api/types";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { isLoggedIn, claims } = storeToRefs(auth);

const post = ref<PostItem | null>(null);
const comments = ref<CommentThreadItem[]>([]);
const commentPage = ref(1);
const commentPagination = ref<{ total: number; limit: number; hasNext: boolean } | null>(null);
const loading = ref(false);
const commentsLoading = ref(false);

const postId = computed(() => Number(route.params.id));

const newComment = ref("");
const replyTo = ref<CommentReplyItem | null>(null);

async function loadPost() {
  loading.value = true;
  try {
    const { post: p } = await fetchPostById(postId.value);
    post.value = p;
  } finally {
    loading.value = false;
  }
}

async function loadComments() {
  if (!postId.value) return;
  commentsLoading.value = true;
  try {
    const res = await commentsApi.fetchComments(postId.value, commentPage.value, 20);
    comments.value = res.comments;
    commentPagination.value = {
      total: res.pagination.total,
      limit: res.pagination.limit,
      hasNext: res.pagination.hasNext,
    };
  } finally {
    commentsLoading.value = false;
  }
}

watch(
  () => route.params.id,
  async () => {
    await loadPost();
    commentPage.value = 1;
    await loadComments();
  },
  { immediate: true },
);

watch(commentPage, loadComments);

function formatTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function canDeleteComment(c: CommentReplyItem) {
  const uid = claims.value?.id;
  if (uid == null || !post.value) return false;
  if (c.authorId === uid) return true;
  return post.value.authorId === uid;
}

async function onDeleteComment(cid: number) {
  try {
    await ElMessageBox.confirm("确定删除该评论？", "提示", { type: "warning" });
  } catch {
    return;
  }
  await commentsApi.deleteComment(postId.value, cid);
  ElMessage.success("已删除");
  await loadComments();
}

async function submitComment() {
  const content = newComment.value.trim();
  if (!content) {
    ElMessage.warning("请输入评论内容");
    return;
  }
  await commentsApi.createComment(postId.value, {
    content,
    parentId: replyTo.value?.id ?? undefined,
  });
  ElMessage.success("发表成功");
  newComment.value = "";
  replyTo.value = null;
  commentPage.value = 1;
  await loadComments();
}

function startReply(c: CommentReplyItem) {
  replyTo.value = c;
}

function cancelReply() {
  replyTo.value = null;
}

async function onDeletePost() {
  if (!post.value) return;
  try {
    await ElMessageBox.confirm("确定删除该文章？", "提示", { type: "warning" });
  } catch {
    return;
  }
  await deletePost(post.value.id);
  ElMessage.success("已删除");
  await router.push({ name: "home" });
}

const canEditPost = computed(() => {
  if (!post.value || !claims.value) return false;
  return post.value.authorId === claims.value.id;
});
</script>

<template>
  <div v-loading="loading" class="detail">
    <template v-if="post">
      <div class="head">
        <el-button text class="back" @click="router.push({ name: 'home' })">← 返回列表</el-button>
        <div v-if="canEditPost" class="post-actions">
          <el-button
            type="primary"
            link
            @click="router.push({ name: 'editor-edit', params: { id: String(post.id) } })"
          >
            编辑
          </el-button>
          <el-button type="danger" link @click="onDeletePost">删除</el-button>
        </div>
      </div>
      <h1 class="title">{{ post.title }}</h1>
      <div class="meta">
        <span>{{ post.author?.username }}</span>
        <span class="dot">·</span>
        <span>{{ post.category?.name }}</span>
        <span class="dot">·</span>
        <span>{{ formatTime(post.createdAt) }}</span>
      </div>
      <div class="body">
        <div class="text">{{ post.content }}</div>
        <div v-if="post.images?.length" class="images">
          <img v-for="(src, i) in post.images" :key="i" :src="src" :alt="`配图 ${i + 1}`" />
        </div>
      </div>

      <section class="comments">
        <h2>评论</h2>
        <div v-if="isLoggedIn" class="composer">
          <div v-if="replyTo" class="reply-hint">
            回复 @{{ replyTo.author?.username }}
            <el-button link type="primary" @click="cancelReply">取消</el-button>
          </div>
          <el-input
            v-model="newComment"
            type="textarea"
            :rows="3"
            maxlength="5000"
            show-word-limit
            placeholder="写下你的评论"
          />
          <el-button type="primary" class="send" @click="submitComment">发布</el-button>
        </div>
        <div v-else class="login-tip">登录后可发表评论</div>

        <div v-loading="commentsLoading" class="thread-list">
          <div v-for="thread in comments" :key="thread.id" class="thread">
            <div class="c-head">
              <strong>{{ thread.author?.username }}</strong>
              <span class="time">{{ formatTime(thread.createdAt) }}</span>
              <el-button
                v-if="isLoggedIn"
                link
                type="primary"
                size="small"
                @click="startReply(thread)"
              >
                回复
              </el-button>
              <el-button
                v-if="canDeleteComment(thread)"
                link
                type="danger"
                size="small"
                @click="onDeleteComment(thread.id)"
              >
                删除
              </el-button>
            </div>
            <p class="c-body">{{ thread.content }}</p>
            <div v-for="r in thread.replies" :key="r.id" class="reply">
              <div class="c-head">
                <strong>{{ r.author?.username }}</strong>
                <span class="time">{{ formatTime(r.createdAt) }}</span>
                <el-button
                  v-if="isLoggedIn"
                  link
                  type="primary"
                  size="small"
                  @click="startReply(r)"
                >
                  回复
                </el-button>
                <el-button
                  v-if="canDeleteComment(r)"
                  link
                  type="danger"
                  size="small"
                  @click="onDeleteComment(r.id)"
                >
                  删除
                </el-button>
              </div>
              <p class="c-body">{{ r.content }}</p>
            </div>
          </div>
          <el-empty v-if="!commentsLoading && comments.length === 0" description="暂无评论" />
        </div>
        <div
          v-if="commentPagination && (commentPagination.hasNext || commentPage > 1)"
          class="pager"
        >
          <el-pagination
            :current-page="commentPage"
            :page-size="commentPagination.limit"
            :total="commentPagination.total"
            layout="prev, pager, next"
            background
            @current-change="(p: number) => (commentPage = p)"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.detail {
  padding: 24px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.back {
  padding: 0;
}

.title {
  margin: 0 0 12px;
  font-size: 26px;
  line-height: 1.35;
}

.meta {
  margin-bottom: 24px;
  font-size: 13px;
  color: #999;
}

.dot {
  margin: 0 8px;
}

.body {
  margin-bottom: 32px;
}

.text {
  font-size: 16px;
  line-height: 1.75;
  color: #333;
  white-space: pre-wrap;
}

.images {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.images img {
  max-width: 100%;
  border-radius: 4px;
}

.comments h2 {
  padding-top: 24px;
  margin: 0 0 16px;
  font-size: 18px;
  border-top: 1px solid #f0f0f0;
}

.composer {
  margin-bottom: 24px;
}

.reply-hint {
  margin-bottom: 8px;
  font-size: 13px;
  color: #666;
}

.send {
  margin-top: 8px;
}

.login-tip {
  margin-bottom: 16px;
  font-size: 14px;
  color: #999;
}

.thread {
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
}

.c-head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
  font-size: 13px;
}

.time {
  flex: 1;
  color: #999;
}

.c-body {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #444;
}

.reply {
  padding-left: 12px;
  margin: 8px 0 0 20px;
  border-left: 2px solid #eee;
}

.pager {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
