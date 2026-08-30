import { ElMessage } from "element-plus";
import { ref } from "vue";

import { fetchAdminPost, updatePost } from "@/api/posts";
import type { PostItem } from "@/api/types";

import type { PostEditPayload } from "../types";

/** 编辑帖子对话框的开合与提交；表单草稿由对话框自己持有 */
export function usePostEditDialog(refreshList: () => Promise<void>) {
  const visible = ref(false);
  const saving = ref(false);
  const editingPost = ref<PostItem | null>(null);

  /**
   * 不直接用列表行的数据回填：列表接口出于体积考虑可能截断正文，
   * 拿它当初始值保存会把内容截没。
   */
  async function open(row: PostItem) {
    const { post } = await fetchAdminPost(row.id);
    editingPost.value = post;
    visible.value = true;
  }

  async function save(payload: PostEditPayload) {
    const target = editingPost.value;
    if (target == null) return;
    saving.value = true;
    try {
      await updatePost(target.id, payload);
      visible.value = false;
      await refreshList();
      ElMessage.success("已保存");
    } finally {
      saving.value = false;
    }
  }

  return { visible, saving, editingPost, open, save };
}
