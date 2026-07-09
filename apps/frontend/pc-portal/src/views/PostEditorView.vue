<script setup lang="ts">
import {
  YanivEditor,
  type EditorAppearance,
  type EditorColorMode,
  type EditorMode,
  type EditorPreset,
  type FeatureConfig,
} from "@yanivjs/yaniv-editor";
import "@yanivjs/yaniv-editor/style.css";
import "katex/dist/katex.min.css";
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";

import { fetchCategories } from "@/api/categories";
import { createPost, fetchPostForEditor, updatePost } from "@/api/posts";
import type { CategoryTreeNode, PostItem } from "@/api/types";
import { uploadImages } from "@/api/uploads";
import {
  isPostEditorBodyEmpty,
  mergeCoverIntoContent,
  parseEditorContent,
  POST_COVER_ACCEPT,
  validateCoverFile,
} from "@/utils/postEditorCover";
import {
  clearPostEditorDraft,
  formatDraftSavedAt,
  readPostEditorDraft,
  writePostEditorDraft,
} from "@/utils/postEditorDraft";
import { usePostMediaUpload } from "@/utils/usePostMediaUpload";

const EDITOR_ROUTE_LOCK_CLASS = "editor-route-lock";
const AUTOSAVE_DEBOUNCE_MS = 2000;

const EDITOR_MODE: EditorMode = "edit";
const EDITOR_PRESET: EditorPreset = "full";
const EDITOR_APPEARANCE: EditorAppearance = "default";
const EDITOR_COLOR_MODE: EditorColorMode = "light";
const EDITOR_FEATURES: FeatureConfig = { ai: false };

const route = useRoute();
const router = useRouter();

const categories = ref<CategoryTreeNode[]>([]);
const loading = ref(false);
const saving = ref(false);
const coverUploading = ref(false);
const editorRef = ref<InstanceType<typeof YanivEditor> | null>(null);
const editorInitialContent = ref("<p></p>");
const editorBodyFilled = ref(false);
const coverUrl = ref<string | null>(null);
const coverInputRef = ref<HTMLInputElement | null>(null);
const draftSavedAt = ref<number | null>(null);
const dirty = ref(false);
const initialSnapshot = ref("");

const form = reactive({
  title: "",
  categoryId: null as number | null,
  published: true,
});

const { handleUploadImage, handleUploadVideo } = usePostMediaUpload();

const editId = computed(() => {
  const raw = route.params.id;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
});

const pageTitle = computed(() => (editId.value != null ? "编辑文章" : "写文章"));

const publishButtonLabel = computed(() => (editId.value != null ? "保存并发布" : "发布"));

const autosaveHintText = computed(() => {
  if (draftSavedAt.value == null) return "";
  return `草稿已保存 · ${formatDraftSavedAt(draftSavedAt.value)}`;
});

const leafOptions = computed(() => {
  const out: { label: string; value: number }[] = [];
  for (const root of categories.value) {
    for (const leaf of root.children ?? []) {
      out.push({ label: `${root.name} / ${leaf.name}`, value: leaf.id });
    }
  }
  return out;
});

const checklistItems = computed(() => [
  {
    key: "title",
    label: "标题",
    done: form.title.trim().length > 0,
    required: true,
  },
  {
    key: "body",
    label: "正文",
    done: editorBodyFilled.value,
    required: true,
  },
  {
    key: "category",
    label: "栏目",
    done: form.categoryId != null,
    required: true,
  },
  {
    key: "cover",
    label: "封面",
    done: coverUrl.value != null,
    required: false,
  },
]);

const publishReady = computed(
  () => form.title.trim().length > 0 && editorBodyFilled.value && form.categoryId != null,
);

const requiredChecklistDone = computed(() =>
  checklistItems.value.filter((item) => item.required).every((item) => item.done),
);

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

function lockEditorRouteScroll() {
  document.documentElement.classList.add(EDITOR_ROUTE_LOCK_CLASS);
}

function unlockEditorRouteScroll() {
  document.documentElement.classList.remove(EDITOR_ROUTE_LOCK_CLASS);
}

function takeSnapshot(): string {
  return JSON.stringify({
    title: form.title,
    categoryId: form.categoryId,
    published: form.published,
    coverUrl: coverUrl.value,
    contentHtml: editorRef.value?.getHTML() ?? editorInitialContent.value,
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

async function refreshEditorBodyStateWhenReady() {
  refreshEditorBodyState();
  await nextTick();
  refreshEditorBodyState();
  requestAnimationFrame(() => refreshEditorBodyState());
}

async function hydrateCategories() {
  const { categories: tree } = await fetchCategories();
  categories.value = tree;
}

function applyPost(p: PostItem) {
  const { coverUrl: cover, bodyHtml } = parseEditorContent(p.content ?? "");
  form.title = p.title;
  form.categoryId = p.categoryId;
  form.published = p.published;
  coverUrl.value = cover;
  editorInitialContent.value = bodyHtml;
}

function applyDraft(draft: ReturnType<typeof readPostEditorDraft>) {
  if (draft == null) return;
  form.title = draft.title;
  form.categoryId = draft.categoryId;
  form.published = draft.published;
  coverUrl.value = draft.coverUrl;
  editorInitialContent.value = draft.contentHtml?.trim() || "<p></p>";
  draftSavedAt.value = draft.savedAt;
}

function scheduleAutosave() {
  if (autosaveTimer != null) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    persistDraft();
  }, AUTOSAVE_DEBOUNCE_MS);
}

function persistDraft() {
  if (loading.value || saving.value) return;
  const contentHtml = editorRef.value?.getHTML() ?? editorInitialContent.value;
  const savedAt = Date.now();
  writePostEditorDraft(editId.value, {
    title: form.title,
    categoryId: form.categoryId,
    published: form.published,
    coverUrl: coverUrl.value,
    contentHtml,
    savedAt,
  });
  draftSavedAt.value = savedAt;
  markDirty();
}

async function processCoverFile(file: File) {
  const err = validateCoverFile(file);
  if (err != null) {
    ElMessage.warning(err);
    return;
  }
  coverUploading.value = true;
  try {
    const { urls } = await uploadImages([file]);
    const url = urls[0];
    if (url == null || url === "") throw new Error("上传失败");
    coverUrl.value = url;
    markDirty();
    scheduleAutosave();
    ElMessage.success("封面上传成功");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "封面上传失败");
  } finally {
    coverUploading.value = false;
  }
}

function onCoverInputChange(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file != null) void processCoverFile(file);
}

function openCoverPicker() {
  coverInputRef.value?.click();
}

function onCoverDrop(ev: DragEvent) {
  ev.preventDefault();
  const file = ev.dataTransfer?.files?.[0];
  if (file != null) void processCoverFile(file);
}

function onCoverDragOver(ev: DragEvent) {
  ev.preventDefault();
}

function removeCover() {
  coverUrl.value = null;
  markDirty();
  scheduleAutosave();
}

onMounted(async () => {
  lockEditorRouteScroll();
  loading.value = true;
  try {
    await hydrateCategories();
    if (editId.value != null) {
      const p = await fetchPostForEditor(editId.value);
      applyPost(p);
      const local = readPostEditorDraft(editId.value);
      if (local != null && local.savedAt > new Date(p.updatedAt).getTime()) {
        applyDraft(local);
        ElMessage.info("已恢复本地草稿");
      }
    } else {
      const local = readPostEditorDraft(null);
      if (local != null) {
        applyDraft(local);
        ElMessage.info("已恢复本地草稿");
      }
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
    await router.push({ name: "mine" });
  } finally {
    loading.value = false;
    await refreshEditorBodyStateWhenReady();
    resetDirtyBaseline();
  }
});

watch(editorRef, async (ed) => {
  if (ed == null || loading.value) return;
  await refreshEditorBodyStateWhenReady();
  resetDirtyBaseline();
});

onBeforeUnmount(() => {
  unlockEditorRouteScroll();
  if (autosaveTimer != null) clearTimeout(autosaveTimer);
});

watch(
  () => [form.title, form.categoryId, form.published, coverUrl.value] as const,
  () => {
    markDirty();
    scheduleAutosave();
  },
);

function getEditorContentHtml(): string {
  return editorRef.value?.getHTML()?.trim() ?? "";
}

function getEditorPlainText(): string {
  return editorRef.value?.getText()?.trim() ?? "";
}

function onEditorUpdate() {
  refreshEditorBodyState();
  markDirty();
  scheduleAutosave();
}

async function saveAsDraft() {
  await save(false);
}

async function saveAndPublish() {
  await save(true);
}

async function save(published?: boolean) {
  const bodyHtml = getEditorContentHtml();
  const plain = getEditorPlainText();
  if (!form.title.trim() || isPostEditorBodyEmpty(bodyHtml, plain)) {
    ElMessage.warning("标题与正文不能为空");
    return;
  }
  if (form.categoryId == null) {
    ElMessage.warning("请选择栏目");
    return;
  }
  const willPublish = published ?? form.published;
  const content = mergeCoverIntoContent(bodyHtml, coverUrl.value, form.title.trim());
  saving.value = true;
  try {
    const payload = {
      title: form.title.trim(),
      content,
      categoryId: form.categoryId,
      published: willPublish,
    };
    if (editId.value == null) {
      await createPost(payload);
      ElMessage.success(willPublish ? "发布成功" : "草稿已保存");
    } else {
      await updatePost(editId.value, payload);
      ElMessage.success(willPublish ? "已保存并发布" : "草稿已保存");
    }
    form.published = willPublish;
    clearPostEditorDraft(editId.value);
    dirty.value = false;
    await router.push({ name: "mine" });
  } finally {
    saving.value = false;
  }
}

async function confirmDiscardIfDirty(): Promise<boolean> {
  if (!dirty.value) return true;
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
  if (saving.value) return true;
  return confirmDiscardIfDirty();
});
</script>

<template>
  <div v-loading="loading" class="post-editor">
    <header class="post-editor__header">
      <div class="post-editor__header-inner">
        <div class="post-editor__header-start">
          <button type="button" class="post-editor__back" @click="leaveEditor">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
            <span>返回</span>
          </button>
          <h1 class="post-editor__heading">{{ pageTitle }}</h1>
        </div>

        <div class="post-editor__header-end">
          <p v-if="autosaveHintText" class="post-editor__autosave">{{ autosaveHintText }}</p>
          <div class="post-editor__header-actions">
            <el-button
              class="post-editor__btn post-editor__btn--ghost"
              :loading="saving"
              @click="saveAsDraft"
            >
              存草稿
            </el-button>
            <el-button
              type="primary"
              class="post-editor__btn post-editor__btn--primary"
              :loading="saving"
              :disabled="!publishReady"
              @click="saveAndPublish"
            >
              {{ publishButtonLabel }}
            </el-button>
          </div>
        </div>
      </div>
    </header>

    <div class="post-editor__workspace">
      <main class="post-editor__main">
        <article class="post-editor__surface">
          <div class="post-editor__title-zone">
            <el-input
              v-model="form.title"
              class="post-editor__title-input"
              maxlength="200"
              show-word-limit
              placeholder="输入标题"
            />
          </div>

          <div class="post-editor__title-divider" aria-hidden="true" />

          <section class="post-editor__body yaniv-editor-host">
            <YanivEditor
              v-if="!loading"
              ref="editorRef"
              :mode="EDITOR_MODE"
              :preset="EDITOR_PRESET"
              :appearance="EDITOR_APPEARANCE"
              :color-mode="EDITOR_COLOR_MODE"
              :features="EDITOR_FEATURES"
              locale="zh-CN"
              :initial-content="editorInitialContent"
              :upload-image="handleUploadImage"
              :upload-video="handleUploadVideo"
              @update="onEditorUpdate"
            />
          </section>
        </article>
      </main>

      <aside class="post-editor__sidebar" aria-label="发布设置">
        <section class="sidebar-card sidebar-card--checklist">
          <div class="sidebar-card__head">
            <h2 class="sidebar-card__title">发布前检查</h2>
            <span
              class="sidebar-card__badge"
              :class="requiredChecklistDone ? 'is-ready' : 'is-pending'"
            >
              {{ requiredChecklistDone ? "可发布" : "待完善" }}
            </span>
          </div>
          <ul class="checklist">
            <li
              v-for="item in checklistItems"
              :key="item.key"
              class="checklist__item"
              :class="{ 'is-done': item.done, 'is-optional': !item.required }"
            >
              <span class="checklist__mark" aria-hidden="true">
                <svg v-if="item.done" viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              </span>
              <span class="checklist__label">
                {{ item.label }}
                <span v-if="!item.required" class="checklist__tag">可选</span>
              </span>
              <span class="checklist__status">{{ item.done ? "已完成" : "未完成" }}</span>
            </li>
          </ul>
        </section>

        <section class="sidebar-card">
          <h2 class="sidebar-card__title">选择栏目</h2>
          <p class="sidebar-card__desc">发布前必须选择二级栏目</p>
          <el-select
            v-model="form.categoryId"
            placeholder="请选择栏目"
            filterable
            class="post-editor__select"
            :class="{ 'is-empty': form.categoryId == null }"
          >
            <el-option v-for="o in leafOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </section>

        <section class="sidebar-card">
          <h2 class="sidebar-card__title">封面图</h2>
          <p class="sidebar-card__desc">可选，用于列表与分享展示</p>
          <input
            ref="coverInputRef"
            type="file"
            class="cover-file-input"
            :accept="POST_COVER_ACCEPT"
            @change="onCoverInputChange"
          />
          <div
            v-if="coverUrl"
            class="cover-preview"
            @dragover="onCoverDragOver"
            @drop="onCoverDrop"
          >
            <img class="cover-preview__img" :src="coverUrl" alt="封面预览" />
            <div class="cover-preview__actions">
              <el-button size="small" :loading="coverUploading" @click="openCoverPicker">
                更换
              </el-button>
              <el-button size="small" type="danger" plain @click="removeCover">移除</el-button>
            </div>
          </div>
          <button
            v-else
            type="button"
            class="cover-upload"
            :disabled="coverUploading"
            @click="openCoverPicker"
            @dragover="onCoverDragOver"
            @drop="onCoverDrop"
          >
            <span class="cover-upload__icon" aria-hidden="true">+</span>
            <span>{{ coverUploading ? "上传中…" : "点击或拖拽上传" }}</span>
          </button>
          <p class="sidebar-card__hint">建议 1200×630，JPG/PNG，不超过 5MB</p>
        </section>
      </aside>
    </div>

    <footer class="post-editor__mobile-bar" aria-label="快捷操作">
      <el-button
        class="post-editor__btn post-editor__btn--ghost"
        :loading="saving"
        @click="saveAsDraft"
      >
        存草稿
      </el-button>
      <el-button
        type="primary"
        class="post-editor__btn post-editor__btn--primary"
        :loading="saving"
        :disabled="!publishReady"
        @click="saveAndPublish"
      >
        {{ publishButtonLabel }}
      </el-button>
    </footer>
  </div>
</template>

<style scoped lang="scss">
$brand: #ea6f5a;
$brand-hover: #e25b46;
$brand-soft: rgb(234 111 90 / 0.1);
$stroke: #e8ebf0;
$stroke-subtle: rgb(0 0 0 / 0.06);
$shadow-soft: 0 1px 3px rgb(0 0 0 / 0.045);
$shadow-toolbar: 0 1px 3px rgb(0 0 0 / 0.05);
$text-main: #1f2329;
$text-sub: #6b7280;
$text-muted: #9aa3b2;
$surface: #fff;
$surface-soft: #fafbfd;
$radius-md: 10px;
$radius-lg: 12px;
$layout-max-width: 1360px;

.post-editor {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: $surface-soft;
}

.post-editor__header {
  flex-shrink: 0;
  background: $surface;
  border-bottom: 1px solid $stroke;
}

.post-editor__header-inner {
  box-sizing: border-box;
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  max-width: $layout-max-width;
  min-height: 56px;
  padding: 10px 20px;
  margin: 0 auto;
}

.post-editor__header-start {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.post-editor__back {
  display: inline-flex;
  flex-shrink: 0;
  gap: 2px;
  align-items: center;
  padding: 6px 10px 6px 6px;
  font-size: 14px;
  font-weight: 500;
  color: $text-sub;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;

  &:hover {
    color: $brand;
    background: rgb(0 0 0 / 0.04);
  }
}

.post-editor__heading {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  color: $text-main;
  white-space: nowrap;
}

.post-editor__header-end {
  display: flex;
  flex-shrink: 0;
  gap: 12px;
  align-items: center;
}

.post-editor__autosave {
  margin: 0;
  font-size: 12px;
  color: $text-muted;
  white-space: nowrap;
}

.post-editor__header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.post-editor__btn {
  height: 36px;
  padding: 0 16px;
  margin: 0;
  font-size: 14px;
  border-radius: 999px;
}

.post-editor__btn--ghost {
  color: $text-sub;
  border: 1px solid $stroke;
}

.post-editor__btn--primary {
  font-weight: 600;
  color: #fff;
  background: $brand;
  border: 0;

  &:hover,
  &:focus {
    background: $brand-hover;
  }

  &.is-disabled {
    color: #fff;
    background: rgb(234 111 90 / 0.45);
  }
}

.post-editor__workspace {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 16px;
  max-width: $layout-max-width;
  min-height: 0;
  padding: 16px 20px;
  margin: 0 auto;
}

.post-editor__main {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.post-editor__surface {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: $surface;
  border: 1px solid $stroke;
  border-radius: $radius-lg;
  box-shadow: $shadow-soft;
}

.post-editor__title-zone {
  flex-shrink: 0;
  padding: 20px 24px 12px;
}

.post-editor__title-input :deep(.el-input__wrapper) {
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none !important;
}

.post-editor__title-input :deep(.el-input__inner) {
  height: 32px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  color: $text-main;

  &::placeholder {
    font-weight: 400;
    color: #c5cad3;
  }
}

.post-editor__title-input :deep(.el-input__count) {
  font-size: 12px;
  color: $text-muted;
}

.post-editor__title-divider {
  flex-shrink: 0;
  height: 1px;
  margin: 0 24px;
  background: $stroke-subtle;
}

.post-editor__body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.post-editor__body.yaniv-editor-host :deep(.yaniv-editor.document-layout) {
  --ye-footer-bg: #{$surface};
}

.post-editor__sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
}

.sidebar-card {
  flex-shrink: 0;
  padding: 16px;
  background: $surface;
  border: 1px solid $stroke;
  border-radius: $radius-lg;
  box-shadow: $shadow-soft;
}

.sidebar-card--checklist {
  background: linear-gradient(180deg, #fff 0%, $surface-soft 100%);
}

.sidebar-card__head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.sidebar-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: $text-main;
}

.sidebar-card__badge {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;

  &.is-ready {
    color: #0f766e;
    background: rgb(15 118 110 / 0.12);
  }

  &.is-pending {
    color: #b45309;
    background: rgb(180 83 9 / 0.12);
  }
}

.sidebar-card__desc {
  margin: 4px 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: $text-muted;
}

.sidebar-card__hint {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: $text-muted;
}

.checklist {
  padding: 0;
  margin: 0;
  list-style: none;
}

.checklist__item {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid $stroke-subtle;

  &:last-child {
    border-bottom: 0;
  }

  &.is-done .checklist__mark {
    color: #0f766e;
    background: rgb(15 118 110 / 0.12);
    border-color: transparent;
  }

  &.is-done .checklist__status {
    color: #0f766e;
  }

  &.is-optional .checklist__status {
    color: $text-muted;
  }
}

.checklist__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: transparent;
  border: 1.5px solid rgb(0 0 0 / 0.12);
  border-radius: 50%;
}

.checklist__label {
  font-size: 13px;
  font-weight: 500;
  color: $text-main;
}

.checklist__tag {
  margin-left: 4px;
  font-size: 11px;
  font-weight: 500;
  color: $text-muted;
}

.checklist__status {
  font-size: 12px;
  color: #b45309;
}

.post-editor__select {
  width: 100%;

  &.is-empty :deep(.el-select__wrapper) {
    box-shadow: 0 0 0 1px rgb(234 111 90 / 0.35) inset;
  }
}

.post-editor__select :deep(.el-select__wrapper) {
  min-height: 38px;
  padding: 0 12px;
  border-radius: $radius-md;
  box-shadow: 0 0 0 1px $stroke inset;
}

.cover-file-input {
  display: none;
}

.cover-upload {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 120px;
  font-size: 13px;
  color: $text-muted;
  cursor: pointer;
  background: $surface-soft;
  border: 1px dashed rgb(0 0 0 / 0.1);
  border-radius: $radius-md;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;

  &:hover:not(:disabled) {
    background: $brand-soft;
    border-color: rgb(234 111 90 / 0.45);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.7;
  }
}

.cover-upload__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 20px;
  line-height: 1;
  color: $brand;
  background: $brand-soft;
  border-radius: 50%;
}

.cover-preview {
  overflow: hidden;
  border: 1px solid $stroke;
  border-radius: $radius-md;
}

.cover-preview__img {
  display: block;
  width: 100%;
  max-height: 140px;
  object-fit: cover;
}

.cover-preview__actions {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: $surface-soft;
}

.post-editor__mobile-bar {
  display: none;
}

@media (width < 920px) {
  .post-editor {
    height: auto;
    min-height: 100dvh;
    padding-bottom: 72px;
    overflow: auto;
  }

  .post-editor__header-inner {
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px 14px;
  }

  .post-editor__header-start {
    flex: 1 1 100%;
  }

  .post-editor__header-end {
    flex-wrap: wrap;
    justify-content: space-between;
    width: 100%;
  }

  .post-editor__header-actions {
    display: none;
  }

  .post-editor__workspace {
    grid-template-columns: 1fr;
    padding: 12px 14px;
  }

  .post-editor__main {
    min-height: 58vh;
  }

  .post-editor__title-zone {
    padding: 16px 16px 10px;
  }

  .post-editor__title-divider {
    margin: 0 16px;
  }

  .post-editor__title-input :deep(.el-input__inner) {
    height: 38px;
    font-size: 22px;
  }

  .post-editor__sidebar {
    overflow: visible;
  }

  .post-editor__mobile-bar {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 50;
    box-sizing: border-box;
    display: flex;
    gap: 10px;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0));
    background: rgb(255 255 255 / 0.96);
    border-top: 1px solid $stroke;
    backdrop-filter: blur(8px);
  }

  .post-editor__mobile-bar .post-editor__btn {
    flex: 1;
  }
}
</style>
