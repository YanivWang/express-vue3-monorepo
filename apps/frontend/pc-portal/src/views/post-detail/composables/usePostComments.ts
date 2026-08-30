import { ElMessage, ElMessageBox } from "element-plus";
import { storeToRefs } from "pinia";
import { computed, ref, watch, type Ref } from "vue";

import * as commentsApi from "@/api/comments";
import type { CommentReplyItem, CommentThreadItem, PostItem } from "@/api/types";
import { useAuthStore } from "@/stores/auth";

const PAGE_SIZE = 20;

export interface UsePostCommentsOptions {
  postId: Ref<number>;
  /** 判定删除权限要看文章作者，故需要文章本体 */
  post: Ref<PostItem | null>;
  /**
   * 评论数量变化后刷新文章。
   * 评论数、热度这些计数挂在文章上，只重拉评论列表的话页头计数会对不上。
   */
  refreshPost: () => Promise<void>;
}

export interface CommentPagination {
  total: number;
  commentTotal: number;
  limit: number;
  hasNext: boolean;
}

/** 评论区：列表分页、排序、发表、删除，以及楼内回复的草稿状态 */
export function usePostComments(options: UsePostCommentsOptions) {
  const { postId, post, refreshPost } = options;
  const { claims, profile } = storeToRefs(useAuthStore());

  const comments = ref<CommentThreadItem[]>([]);
  const commentPage = ref(1);
  const commentPagination = ref<CommentPagination | null>(null);
  const commentsLoading = ref(false);
  const commentSort = ref<"desc" | "asc">("desc");

  const newComment = ref("");
  /** 内联回复目标（主评或楼内回复）；顶栏输入框只发主评 */
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

  async function loadComments() {
    if (!postId.value) return;
    commentsLoading.value = true;
    try {
      const res = await commentsApi.fetchComments(postId.value, commentPage.value, PAGE_SIZE);
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

  watch(commentPage, loadComments);

  /** 发表/删除之后统一回到第一页并刷新文章与列表 */
  async function refreshAfterMutation() {
    commentPage.value = 1;
    await refreshPost();
    await loadComments();
  }

  function resetInlineReply() {
    activeInlineTarget.value = null;
    inlineDraft.value = "";
  }

  async function submitComment() {
    const content = newComment.value.trim();
    if (!content) {
      ElMessage.warning("请输入评论内容");
      return;
    }
    await commentsApi.createComment(postId.value, { content });
    ElMessage.success("发表成功");
    newComment.value = "";
    resetInlineReply();
    await refreshAfterMutation();
  }

  function startInlineReply(c: CommentReplyItem) {
    activeInlineTarget.value = c;
    inlineDraft.value = "";
  }

  function cancelInlineReply() {
    resetInlineReply();
  }

  async function submitInlineReply() {
    const target = activeInlineTarget.value;
    if (!target) return;
    const content = inlineDraft.value.trim();
    if (!content) {
      ElMessage.warning("请输入回复内容");
      return;
    }
    await commentsApi.createComment(postId.value, { content, parentId: target.id });
    ElMessage.success("发表成功");
    resetInlineReply();
    await refreshAfterMutation();
  }

  function canDeleteComment(c: CommentReplyItem) {
    const uid = claims.value?.id;
    if (uid == null || !post.value) return false;
    if (c.authorId === uid) return true;
    if (post.value.authorId === uid) return true;
    if (profile.value?.permissions?.includes("admin.comments.delete")) return true;
    return false;
  }

  async function onDeleteComment(cid: number) {
    try {
      await ElMessageBox.confirm("确定删除该评论？", "提示", { type: "warning" });
    } catch {
      // 用户取消
      return;
    }
    await commentsApi.deleteComment(postId.value, cid);
    ElMessage.success("已删除");
    await refreshPost();
    await loadComments();
  }

  return {
    comments,
    commentPage,
    commentPagination,
    commentsLoading,
    commentSort,
    sortedComments,
    newComment,
    activeInlineTarget,
    inlineDraft,
    loadComments,
    submitComment,
    startInlineReply,
    cancelInlineReply,
    submitInlineReply,
    canDeleteComment,
    onDeleteComment,
    resetInlineReply,
  };
}
