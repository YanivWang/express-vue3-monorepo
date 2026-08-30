import { ElMessage } from "element-plus";
import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";

import {
  formatDraftSavedAt,
  readPostEditorDraft,
  writePostEditorDraft,
} from "@/utils/postEditorDraft";

import type { PostEditorBridge, PostEditorFormState } from "./usePostEditorForm";

const AUTOSAVE_DEBOUNCE_MS = 2000;

/**
 * 本地草稿：定时落 localStorage，并在进入页面时按需恢复。
 *
 * 恢复策略对新建与编辑不同：新建页只要有草稿就用；编辑页只有当草稿比
 * 服务端版本新时才覆盖，否则会拿旧草稿盖掉别处已经保存的内容。
 */
export function usePostEditorDraft(
  state: PostEditorFormState,
  editId: Ref<number | null>,
  editor: () => PostEditorBridge | null,
) {
  const draftSavedAt = ref<number | null>(null);
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  const autosaveHintText = computed(() => {
    if (draftSavedAt.value == null) return "";
    return `草稿已保存 · ${formatDraftSavedAt(draftSavedAt.value)}`;
  });

  function persistDraft() {
    // 加载中或正在提交时落盘没有意义，还可能把中间态写进去
    if (state.loading.value || state.saving.value) return;
    const contentHtml = editor()?.getHTML() ?? state.editorInitialContent.value;
    const savedAt = Date.now();
    writePostEditorDraft(editId.value, {
      title: state.form.title,
      categoryId: state.form.categoryId,
      published: state.form.published,
      coverUrl: state.coverUrl.value,
      contentHtml,
      savedAt,
    });
    draftSavedAt.value = savedAt;
    state.markDirty();
  }

  function scheduleAutosave() {
    if (autosaveTimer != null) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      persistDraft();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function applyDraft(draft: ReturnType<typeof readPostEditorDraft>) {
    if (draft == null) return;
    state.form.title = draft.title;
    state.form.categoryId = draft.categoryId;
    state.form.published = draft.published;
    state.coverUrl.value = draft.coverUrl;
    state.editorInitialContent.value = draft.contentHtml?.trim() || "<p></p>";
    draftSavedAt.value = draft.savedAt;
  }

  /** 新建页：有草稿就恢复 */
  function restoreDraftForNewPost() {
    const local = readPostEditorDraft(null);
    if (local != null) {
      applyDraft(local);
      ElMessage.info("已恢复本地草稿");
    }
  }

  /** 编辑页：仅当草稿晚于服务端 updatedAt 才恢复 */
  function restoreDraftIfNewerThan(id: number, serverUpdatedAt: string) {
    const local = readPostEditorDraft(id);
    if (local != null && local.savedAt > new Date(serverUpdatedAt).getTime()) {
      applyDraft(local);
      ElMessage.info("已恢复本地草稿");
    }
  }

  // 表单字段一变就标脏并排定一次自动保存（正文的变化走编辑器 update 事件）
  watch(
    () =>
      [
        state.form.title,
        state.form.categoryId,
        state.form.published,
        state.coverUrl.value,
      ] as const,
    () => {
      state.markDirty();
      scheduleAutosave();
    },
  );

  onBeforeUnmount(() => {
    if (autosaveTimer != null) clearTimeout(autosaveTimer);
  });

  return {
    draftSavedAt,
    autosaveHintText,
    persistDraft,
    scheduleAutosave,
    restoreDraftForNewPost,
    restoreDraftIfNewerThan,
  };
}
