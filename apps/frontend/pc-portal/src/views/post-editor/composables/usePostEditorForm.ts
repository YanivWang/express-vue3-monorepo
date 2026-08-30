import { computed, reactive, ref } from "vue";

import type { PostItem } from "@/api/types";
import { isPostEditorBodyEmpty, parseEditorContent } from "@/utils/postEditorCover";

/** 富文本编辑器对外暴露的最小接口，由写作区组件转发 */
export interface PostEditorBridge {
  getHTML(): string;
  getText(): string;
}

/**
 * 写作页的核心表单状态：标题/栏目/封面/正文，以及由它们派生的
 * 发布前检查清单与「有没有未保存改动」。
 *
 * 正文不在 Vue 的响应式里（它住在编辑器内部），所以正文相关的判断
 * 一律通过 editor 存取器现取，而不是缓存一份副本。
 */
export function usePostEditorForm(editor: () => PostEditorBridge | null) {
  const form = reactive({
    title: "",
    categoryId: null as number | null,
    published: true,
  });

  const coverUrl = ref<string | null>(null);
  const editorInitialContent = ref("<p></p>");
  const editorBodyFilled = ref(false);
  const loading = ref(false);
  const saving = ref(false);
  const dirty = ref(false);
  const initialSnapshot = ref("");

  function getEditorContentHtml(): string {
    return editor()?.getHTML()?.trim() ?? "";
  }

  function getEditorPlainText(): string {
    return editor()?.getText()?.trim() ?? "";
  }

  /** 快照用于判断脏状态；正文取编辑器现值，取不到时回落到初始内容 */
  function takeSnapshot(): string {
    return JSON.stringify({
      title: form.title,
      categoryId: form.categoryId,
      published: form.published,
      coverUrl: coverUrl.value,
      contentHtml: editor()?.getHTML() ?? editorInitialContent.value,
    });
  }

  function markDirty() {
    if (loading.value) return;
    dirty.value = takeSnapshot() !== initialSnapshot.value;
  }

  function resetDirtyBaseline() {
    initialSnapshot.value = takeSnapshot();
    dirty.value = false;
  }

  function refreshEditorBodyState() {
    const plain = getEditorPlainText();
    const html = getEditorContentHtml() || editorInitialContent.value;
    editorBodyFilled.value = !isPostEditorBodyEmpty(html, plain);
  }

  /** 把服务端文章灌进表单：正文里的专用封面块要先剥出来 */
  function applyPost(p: PostItem) {
    const { coverUrl: cover, bodyHtml } = parseEditorContent(p.content ?? "");
    form.title = p.title;
    form.categoryId = p.categoryId;
    form.published = p.published;
    coverUrl.value = cover;
    editorInitialContent.value = bodyHtml;
  }

  const checklistItems = computed(() => [
    { key: "title", label: "标题", done: form.title.trim().length > 0, required: true },
    { key: "body", label: "正文", done: editorBodyFilled.value, required: true },
    { key: "category", label: "栏目", done: form.categoryId != null, required: true },
    { key: "cover", label: "封面", done: coverUrl.value != null, required: false },
  ]);

  const publishReady = computed(
    () => form.title.trim().length > 0 && editorBodyFilled.value && form.categoryId != null,
  );

  const requiredChecklistDone = computed(() =>
    checklistItems.value.filter((item) => item.required).every((item) => item.done),
  );

  return {
    form,
    coverUrl,
    editorInitialContent,
    editorBodyFilled,
    loading,
    saving,
    dirty,
    checklistItems,
    publishReady,
    requiredChecklistDone,
    getEditorContentHtml,
    getEditorPlainText,
    refreshEditorBodyState,
    markDirty,
    resetDirtyBaseline,
    applyPost,
  };
}

export type PostEditorFormState = ReturnType<typeof usePostEditorForm>;
