import { ElMessage, ElMessageBox } from "element-plus";
import { storeToRefs } from "pinia";
import { computed, ref, type Ref } from "vue";
import { useRouter } from "vue-router";

import { deletePost, fetchPostById } from "@/api/posts";
import type { PostItem } from "@/api/types";
import { useAuthStore } from "@/stores/auth";
import { sanitizePostBodyHtml } from "@/utils/post-content-sanitize";
import { parseEditorContent } from "@/utils/postEditorCover";

export interface UsePostDetailOptions {
  /**
   * 文章加载成功后、loading 关闭之前执行。
   *
   * 推荐阅读必须留在这个窗口里：正文编辑器是 `v-if="!loading"` 挂载的，
   * 若提前放开 loading，编辑器会在推荐还没就位时先挂一次，白屏闪一下。
   */
  afterLoad?: (post: PostItem) => Promise<void>;
}

/** 文章主体：加载、删除、正文清洗与归属判断 */
export function usePostDetail(postId: Ref<number>, options: UsePostDetailOptions = {}) {
  const router = useRouter();
  const { claims } = storeToRefs(useAuthStore());

  const post = ref<PostItem | null>(null);
  const loading = ref(false);

  async function loadPost() {
    loading.value = true;
    try {
      const { post: p } = await fetchPostById(postId.value);
      post.value = p;
      await options.afterLoad?.(p);
    } finally {
      loading.value = false;
    }
  }

  const canEditPost = computed(() => {
    if (!post.value || !claims.value) return false;
    return post.value.authorId === claims.value.id;
  });

  const postBodyHtml = computed(() => {
    const raw = post.value?.content;
    if (raw == null || raw === "") return "<p></p>";
    const { bodyHtml } = parseEditorContent(raw);
    return sanitizePostBodyHtml(bodyHtml) || "<p></p>";
  });

  async function onDeletePost() {
    if (!post.value) return;
    try {
      await ElMessageBox.confirm("确定删除该文章？", "提示", { type: "warning" });
    } catch {
      // 用户取消：Element Plus 以 reject 表达取消，接住即可
      return;
    }
    await deletePost(post.value.id);
    ElMessage.success("已删除");
    await router.push({ name: "home" });
  }

  return { post, loading, canEditPost, postBodyHtml, loadPost, onDeletePost };
}
