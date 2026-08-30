import { ElMessage, ElMessageBox } from "element-plus";
import { type Ref } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";

import { createPost, updatePost } from "@/api/posts";
import { isPostEditorBodyEmpty, mergeCoverIntoContent } from "@/utils/postEditorCover";
import { clearPostEditorDraft } from "@/utils/postEditorDraft";

import type { PostEditorFormState } from "./usePostEditorForm";

/** 保存、发布，以及带未保存改动时的离开拦截 */
export function usePostEditorSave(state: PostEditorFormState, editId: Ref<number | null>) {
  const router = useRouter();

  async function save(published?: boolean) {
    const bodyHtml = state.getEditorContentHtml();
    const plain = state.getEditorPlainText();
    if (!state.form.title.trim() || isPostEditorBodyEmpty(bodyHtml, plain)) {
      ElMessage.warning("标题与正文不能为空");
      return;
    }
    if (state.form.categoryId == null) {
      ElMessage.warning("请选择栏目");
      return;
    }
    const willPublish = published ?? state.form.published;
    // 封面以专用段落的形式并回正文首段，服务端只存一份 content
    const content = mergeCoverIntoContent(bodyHtml, state.coverUrl.value, state.form.title.trim());
    state.saving.value = true;
    try {
      const payload = {
        title: state.form.title.trim(),
        content,
        categoryId: state.form.categoryId,
        published: willPublish,
      };
      if (editId.value == null) {
        await createPost(payload);
        ElMessage.success(willPublish ? "发布成功" : "草稿已保存");
      } else {
        await updatePost(editId.value, payload);
        ElMessage.success(willPublish ? "已保存并发布" : "草稿已保存");
      }
      state.form.published = willPublish;
      clearPostEditorDraft(editId.value);
      state.dirty.value = false;
      await router.push({ name: "mine" });
    } finally {
      state.saving.value = false;
    }
  }

  async function saveAsDraft() {
    await save(false);
  }

  async function saveAndPublish() {
    await save(true);
  }

  async function confirmDiscardIfDirty(): Promise<boolean> {
    if (!state.dirty.value) return true;
    try {
      await ElMessageBox.confirm("有未保存的修改，确定离开？", "提示", {
        type: "warning",
        confirmButtonText: "离开",
        cancelButtonText: "继续编辑",
      });
      return true;
    } catch {
      return false;
    }
  }

  async function leaveEditor() {
    if (!(await confirmDiscardIfDirty())) return;
    void router.push({ name: "mine" });
  }

  onBeforeRouteLeave(async () => {
    // 保存过程中的跳转是 save() 自己发起的，不该再拦一次
    if (state.saving.value) return true;
    return confirmDiscardIfDirty();
  });

  return { saveAsDraft, saveAndPublish, leaveEditor };
}
