<script setup lang="ts">
import DOMPurify from "dompurify";
import { ElMessage, ElMessageBox } from "element-plus";
import { storeToRefs } from "pinia";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import * as commentsApi from "@/api/comments";
import {
  deletePost,
  fetchPostById,
  fetchPostsList,
  setPostFavoriteHttp,
  votePost,
} from "@/api/posts";
import type { CommentReplyItem, CommentThreadItem, PostItem } from "@/api/types";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { isLoggedIn, claims, profile } = storeToRefs(auth);

const post = ref<PostItem | null>(null);
const recommended = ref<PostItem[]>([]);
const comments = ref<CommentThreadItem[]>([]);
const commentPage = ref(1);
const commentPagination = ref<{
  total: number;
  commentTotal: number;
  limit: number;
  hasNext: boolean;
} | null>(null);
const loading = ref(false);
const interactionLoading = ref(false);
const commentsLoading = ref(false);
const commentSort = ref<"desc" | "asc">("desc");

const postId = computed(() => Number(route.params.id));

const newComment = ref("");
/** 内联回复目标（主评或楼内回复）；顶栏仅发主评 */
const activeInlineTarget = ref<CommentReplyItem | null>(null);
const inlineDraft = ref("");

const sortedComments = computed(() => {
  const arr = [...comments.value];
  arr.sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return commentSort.value === "desc" ? tb - ta : ta - tb;
  });
  return arr;
});

const wordCount = computed(() => {
  const raw = post.value?.content ?? "";
  const text = raw.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
  return text.length;
});

const authorInitial = computed(() => {
  const name = post.value?.author?.username;
  if (name == null || name === "") return "作";
  return name.slice(0, 1);
});

async function loadRecommended(p: PostItem) {
  try {
    const { posts: sameCat } = await fetchPostsList({
      categoryId: p.categoryId,
      page: 1,
      limit: 14,
    });
    const list = sameCat.filter((x) => x.id !== p.id);
    if (list.length < 6) {
      const { posts: anyPosts } = await fetchPostsList({ page: 1, limit: 24 });
      for (const item of anyPosts) {
        if (item.id === p.id) continue;
        if (list.some((x) => x.id === item.id)) continue;
        list.push(item);
        if (list.length >= 12) break;
      }
    }
    recommended.value = list.slice(0, 10);
  } catch {
    recommended.value = [];
  }
}

async function loadPost() {
  loading.value = true;
  try {
    const { post: p } = await fetchPostById(postId.value);
    post.value = p;
    await loadRecommended(p);
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
      commentTotal: res.pagination.commentTotal,
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
    activeInlineTarget.value = null;
    inlineDraft.value = "";
    await loadPost();
    commentPage.value = 1;
    await loadComments();
  },
  { immediate: true },
);

watch(commentPage, loadComments);

function formatDetailTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}.${m}.${day} ${h}:${min}:${s}`;
}

function formatCommentTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}.${day} ${h}:${min}`;
}

function canDeleteComment(c: CommentReplyItem) {
  const uid = claims.value?.id;
  if (uid == null || !post.value) return false;
  if (c.authorId === uid) return true;
  if (post.value.authorId === uid) return true;
  if (profile.value?.role === 1) return true;
  return false;
}

async function onDeleteComment(cid: number) {
  try {
    await ElMessageBox.confirm("确定删除该评论？", "提示", { type: "warning" });
  } catch {
    return;
  }
  await commentsApi.deleteComment(postId.value, cid);
  ElMessage.success("已删除");
  await loadPost();
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
  });
  ElMessage.success("发表成功");
  newComment.value = "";
  commentPage.value = 1;
  activeInlineTarget.value = null;
  inlineDraft.value = "";
  await loadPost();
  await loadComments();
}

function startInlineReply(c: CommentReplyItem) {
  activeInlineTarget.value = c;
  inlineDraft.value = "";
}

function cancelInlineReply() {
  activeInlineTarget.value = null;
  inlineDraft.value = "";
}

async function submitInlineReply() {
  const target = activeInlineTarget.value;
  if (!target) return;
  const content = inlineDraft.value.trim();
  if (!content) {
    ElMessage.warning("请输入回复内容");
    return;
  }
  await commentsApi.createComment(postId.value, {
    content,
    parentId: target.id,
  });
  ElMessage.success("发表成功");
  activeInlineTarget.value = null;
  inlineDraft.value = "";
  commentPage.value = 1;
  await loadPost();
  await loadComments();
}

function showReplyChain(r: CommentReplyItem, threadId: number) {
  return r.parentId !== threadId && Boolean(r.replyToUser?.username);
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

const postBodyHtml = computed(() => {
  const raw = post.value?.content;
  if (raw == null || raw === "") return "";
  return DOMPurify.sanitize(raw);
});

function goBackList() {
  void router.push({ name: "home", query: { ...route.query } });
}

function goRecommended(id: number) {
  void router.push({
    name: "post-detail",
    params: { id: String(id) },
    query: { ...route.query },
  });
}

function requireLoginForInteraction() {
  if (!isLoggedIn.value) {
    ElMessage.warning("请先登录后再操作");
    void router.push({ name: "login", query: { redirect: route.fullPath } });
    return false;
  }
  return true;
}

async function toggleVote(kind: "like" | "dislike") {
  if (!requireLoginForInteraction()) return;
  if (!post.value) return;
  interactionLoading.value = true;
  try {
    const cur = post.value.myVote ?? null;
    const next: "like" | "dislike" | "none" =
      kind === "like" ? (cur === "like" ? "none" : "like") : cur === "dislike" ? "none" : "dislike";
    const { post: p } = await votePost(postId.value, next);
    post.value = p;
  } finally {
    interactionLoading.value = false;
  }
}

async function toggleFavoriteDetail() {
  if (!requireLoginForInteraction()) return;
  if (!post.value) return;
  interactionLoading.value = true;
  try {
    const next = !(post.value.myFavorited ?? false);
    const { post: p } = await setPostFavoriteHttp(postId.value, next);
    post.value = p;
    ElMessage.success(next ? "已加入收藏" : "已取消收藏");
  } finally {
    interactionLoading.value = false;
  }
}

onMounted(() => {
  if (isLoggedIn.value) void auth.fetchProfile();
});

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) void auth.fetchProfile();
});
</script>

<template>
  <div v-loading="loading" class="detail-page">
    <template v-if="post">
      <article class="article-card">
        <div class="toolbar">
          <button type="button" class="linkish" @click="goBackList">← 返回列表</button>
          <div v-if="canEditPost" class="owner-tools">
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

        <div class="author-row">
          <el-avatar class="author-avatar" :size="48" :src="post.author?.avatar ?? undefined">
            {{ authorInitial }}
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
              <span class="engage-metric"
                >评论 {{ (post.commentCount ?? 0).toLocaleString() }}</span
              >
              <span class="engage-dot" aria-hidden="true">·</span>
              <span class="engage-metric"
                >收藏 {{ (post.favoriteCount ?? 0).toLocaleString() }}</span
              >
              <span class="engage-dot" aria-hidden="true">·</span>
              <span class="engage-metric">赞 {{ (post.likeCount ?? 0).toLocaleString() }}</span>
              <template v-if="(post.dislikeCount ?? 0) > 0">
                <span class="engage-dot" aria-hidden="true">·</span>
                <span class="engage-metric"
                  >踩 {{ (post.dislikeCount ?? 0).toLocaleString() }}</span
                >
              </template>
            </div>
            <div class="engage-actions">
              <el-button
                size="small"
                round
                :type="post.myVote === 'like' ? 'primary' : 'default'"
                plain
                :loading="interactionLoading"
                @click.stop="toggleVote('like')"
              >
                {{ post.myVote === "like" ? "已赞" : "点赞" }}
              </el-button>
              <el-button
                size="small"
                round
                :type="post.myVote === 'dislike' ? 'danger' : 'default'"
                plain
                :loading="interactionLoading"
                @click.stop="toggleVote('dislike')"
              >
                {{ post.myVote === "dislike" ? "已踩" : "踩" }}
              </el-button>
              <el-button
                size="small"
                round
                :type="post.myFavorited ? 'warning' : 'default'"
                plain
                :loading="interactionLoading"
                @click.stop="toggleFavoriteDetail"
              >
                {{ post.myFavorited ? "已收藏" : "收藏" }}
              </el-button>
            </div>
          </div>
        </div>

        <div class="body">
          <!-- eslint-disable-next-line vue/no-v-html -- sanitized with DOMPurify -->
          <div class="rich-text" v-html="postBodyHtml" />
          <div v-if="post.images?.length" class="images">
            <img v-for="(src, i) in post.images" :key="i" :src="src" :alt="`配图 ${i + 1}`" />
          </div>
        </div>

        <p class="disclaimer">本文观点仅代表作者本人，本站仅提供信息存储空间服务。</p>

        <div class="author-foot">
          <el-avatar :size="52" :src="post.author?.avatar ?? undefined">{{
            authorInitial
          }}</el-avatar>
          <div class="author-foot-text">
            <div class="author-foot-name">{{ post.author?.username ?? "作者" }}</div>
            <div class="author-foot-sub">在本站发布的文章内容</div>
          </div>
        </div>

        <section class="comments">
          <div class="comments-hd">
            <h2 class="side-heading">
              全部评论
              <span class="count">{{
                (commentPagination?.commentTotal ?? post.commentCount ?? 0).toLocaleString()
              }}</span>
            </h2>
            <div class="sort-row">
              <button
                type="button"
                class="sort-btn"
                :class="{ 'sort-btn--on': commentSort === 'desc' }"
                @click="commentSort = 'desc'"
              >
                按时间倒序
              </button>
              <button
                type="button"
                class="sort-btn"
                :class="{ 'sort-btn--on': commentSort === 'asc' }"
                @click="commentSort = 'asc'"
              >
                按时间正序
              </button>
            </div>
          </div>

          <div v-if="isLoggedIn" class="composer">
            <el-input
              v-model="newComment"
              class="comment-input"
              type="textarea"
              :rows="4"
              maxlength="5000"
              show-word-limit
              placeholder="写下你的评论…"
            />
            <el-button type="primary" round class="send" @click="submitComment">发布评论</el-button>
          </div>
          <div v-else class="login-tip">登录后可发表评论</div>

          <div v-loading="commentsLoading" class="thread-list">
            <div v-for="thread in sortedComments" :key="thread.id" class="thread">
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
                      @click="startInlineReply(thread)"
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
                </div>
                <p class="c-body">{{ thread.content }}</p>
                <div
                  v-if="isLoggedIn && activeInlineTarget?.id === thread.id"
                  class="inline-composer"
                >
                  <div class="inline-hint">
                    回复 {{ thread.author?.username }}
                    <el-button link type="primary" size="small" @click="cancelInlineReply"
                      >取消</el-button
                    >
                  </div>
                  <el-input
                    v-model="inlineDraft"
                    class="comment-input comment-input--inline"
                    type="textarea"
                    :rows="3"
                    maxlength="5000"
                    show-word-limit
                    :placeholder="`回复 ${thread.author?.username ?? ''}…`"
                  />
                  <el-button
                    type="primary"
                    round
                    size="small"
                    class="inline-send"
                    @click="submitInlineReply"
                    >发布</el-button
                  >
                </div>
                <div class="replies-wrap">
                  <div v-for="r in thread.replies ?? []" :key="r.id" class="reply">
                    <el-avatar
                      class="c-avatar c-avatar--sm"
                      :size="32"
                      :src="r.author?.avatar ?? undefined"
                    >
                      {{ (r.author?.username ?? "?").slice(0, 1) }}
                    </el-avatar>
                    <div class="c-main">
                      <div class="c-head c-head--reply">
                        <template v-if="showReplyChain(r, thread.id)">
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
                            @click="startInlineReply(r)"
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
                      </div>
                      <p class="c-body">{{ r.content }}</p>
                      <div
                        v-if="isLoggedIn && activeInlineTarget?.id === r.id"
                        class="inline-composer inline-composer--nested"
                      >
                        <div class="inline-hint">
                          回复 {{ r.author?.username }}
                          <el-button link type="primary" size="small" @click="cancelInlineReply"
                            >取消</el-button
                          >
                        </div>
                        <el-input
                          v-model="inlineDraft"
                          class="comment-input comment-input--inline"
                          type="textarea"
                          :rows="3"
                          maxlength="5000"
                          show-word-limit
                          :placeholder="`回复 ${r.author?.username ?? ''}…`"
                        />
                        <el-button
                          type="primary"
                          round
                          size="small"
                          class="inline-send"
                          @click="submitInlineReply"
                          >发布</el-button
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <el-empty
              v-if="!commentsLoading && sortedComments.length === 0"
              description="暂无评论"
            />
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
      </article>

      <aside class="sidebar">
        <div class="rec-card">
          <h3 class="side-heading">推荐阅读</h3>
          <ul class="rec-list">
            <li v-for="item in recommended" :key="item.id">
              <button type="button" class="rec-link" @click="goRecommended(item.id)">
                {{ item.title }}
              </button>
            </li>
          </ul>
          <p v-if="!recommended.length" class="rec-empty">暂无推荐</p>
        </div>
      </aside>
    </template>
  </div>
</template>

<style scoped lang="scss">
$brand: #ea6f5a;
$text: #333;
$muted: #969696;
$line: #f0f0f0;
$bg-soft: #fafafa;

.detail-page {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 20px 28px;
  align-items: start;
  min-height: 320px;

  @media (width <= 960px) {
    grid-template-columns: minmax(0, 1fr);

    .sidebar {
      grid-column: 1 / -1;
    }
  }
}

.article-card {
  padding: 28px 36px 40px;
  background: #fff;
  border: 1px solid rgb(0 0 0 / 4%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 3%);

  @media (width <= 640px) {
    padding: 20px 16px 32px;
  }
}

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

.body {
  margin-bottom: 28px;
}

.rich-text {
  font-size: 16px;
  line-height: 1.85;
  color: #2f2f2f;
  overflow-wrap: break-word;
}

.rich-text :deep(p) {
  margin: 0 0 14px;

  &:last-child {
    margin-bottom: 0;
  }
}

.rich-text :deep(h2) {
  font-size: 24px;
}

.rich-text :deep(h3) {
  font-size: 22px;
}

.rich-text :deep(h4) {
  font-size: 18px;
}

.rich-text :deep(h2),
.rich-text :deep(h3),
.rich-text :deep(h4) {
  margin: 1.35em 0 0.55em;
  font-weight: 700;
  color: $text;

  &:first-child {
    margin-top: 0;
  }
}

.rich-text :deep(ul),
.rich-text :deep(ol) {
  padding-left: 1.35em;
  margin: 0 0 14px;
}

.rich-text :deep(blockquote) {
  padding-left: 12px;
  margin: 0 0 14px;
  color: #666;
  border-left: 4px solid #e8e8e8;
}

.rich-text :deep(pre),
.rich-text :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.rich-text :deep(:not(pre) code) {
  font-size: 13px;
}

.rich-text :deep(pre) {
  padding: 12px;
  margin: 0 0 14px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.55;
  background: $bg-soft;
  border-radius: 6px;
}

.rich-text :deep(img) {
  max-width: 100%;
  height: auto;
  vertical-align: middle;
}

.rich-text :deep(a) {
  color: #3194d0;

  &:hover {
    text-decoration: underline;
  }
}

.images {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
}

.images img {
  max-width: 100%;
  border-radius: 6px;
}

.disclaimer {
  padding: 16px;
  margin: 0 0 24px;
  font-size: 13px;
  line-height: 1.6;
  color: $muted;
  background: $bg-soft;
  border-radius: 6px;
}

.author-foot {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 20px;
  margin-bottom: 32px;
  background: $bg-soft;
  border: 1px solid $line;
  border-radius: 8px;
}

.author-foot-name {
  margin-bottom: 4px;
  font-size: 16px;
  font-weight: 600;
  color: $text;
}

.author-foot-sub {
  font-size: 13px;
  color: $muted;
}

.side-heading {
  position: relative;
  display: flex;
  gap: 8px;
  align-items: center;
  padding-left: 12px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: $text;

  &::before {
    position: absolute;
    top: 50%;
    left: 0;
    width: 4px;
    height: 16px;
    content: "";
    background: $brand;
    border-radius: 2px;
    transform: translateY(-50%);
  }

  .count {
    font-weight: 600;
    color: $muted;
  }
}

.comments {
  padding-top: 8px;
  margin-top: 8px;
  border-top: 1px solid $line;
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

.comment-input :deep(.el-textarea__inner) {
  padding: 14px 16px;
  font-size: 15px;
  line-height: 1.65;
  resize: vertical;
  background: $bg-soft;
  border: 1px solid #e2e2e2;
  border-radius: 10px;
  box-shadow: none;
}

.comment-input :deep(.el-textarea__inner:focus) {
  background: #fff;
  border-color: rgb(234 111 90 / 55%);
}

.inline-composer {
  padding: 12px 0 4px;
  margin-top: 4px;
  border-top: 1px dashed rgb(234 111 90 / 25%);

  &--nested {
    padding-bottom: 0;
    margin-top: 10px;
    border-top: none;
  }
}

.inline-hint {
  margin-bottom: 8px;
  font-size: 13px;
  color: #666;
}

.comment-input--inline :deep(.el-textarea__inner) {
  min-height: 72px;
  font-size: 14px;
}

.inline-send {
  margin-top: 8px;
  background: $brand;
  border-color: $brand;

  &:hover {
    background: #e25b46;
    border-color: #e25b46;
  }
}

.c-head--reply {
  align-items: flex-start;
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

.send {
  padding-right: 22px;
  padding-left: 22px;
  margin-top: 12px;
  background: $brand;
  border-color: $brand;

  &:hover {
    background: #e25b46;
    border-color: #e25b46;
  }
}

.login-tip {
  margin-bottom: 16px;
  font-size: 14px;
  color: $muted;
}

.thread-list {
  min-height: 80px;
}

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

.reply {
  display: flex;
  gap: 10px;
  padding: 12px 0 0 4px;
  margin-top: 12px;
  border-top: 1px solid #f5f5f5;
}

.pager {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.sidebar {
  position: sticky;
  top: 88px;
}

.rec-card {
  padding: 20px 18px;
  background: #fff;
  border: 1px solid rgb(0 0 0 / 4%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 3%);
}

.rec-card .side-heading {
  margin-bottom: 14px;
}

.rec-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.rec-list li + li {
  margin-top: 4px;
}

.rec-link {
  display: block;
  width: 100%;
  padding: 8px 0;
  font-size: 14px;
  line-height: 1.5;
  color: #404040;
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  transition: color 0.15s;

  &:hover {
    color: $brand;
  }
}

.rec-empty {
  margin: 0;
  font-size: 13px;
  color: $muted;
}
</style>
