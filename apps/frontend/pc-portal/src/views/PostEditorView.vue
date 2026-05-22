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

const pageTitle = computed(() => (editId.value != null ? "编辑帖子" : "写帖子"));

const saveButtonLabel = computed(() => {
  if (form.published) return editId.value != null ? "保存并发布" : "发布";
  return "保存草稿";
});

const autosaveHintText = computed(() => {
  if (draftSavedAt.value == null) return "";
  return `草稿已自动保存于 ${formatDraftSavedAt(draftSavedAt.value)}`;
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
    await nextTick();
    resetDirtyBaseline();
  }
});

watch(editorRef, async (ed) => {
  if (ed == null || loading.value) return;
  await nextTick();
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
  markDirty();
  scheduleAutosave();
}

async function save() {
  const bodyHtml = getEditorContentHtml();
  const plain = getEditorPlainText();
  if (!form.title.trim() || !plain) {
    ElMessage.warning("标题与正文不能为空");
    return;
  }
  if (form.categoryId == null) {
    ElMessage.warning("请选择分类（须为二级叶子）");
    return;
  }
  const content = mergeCoverIntoContent(bodyHtml, coverUrl.value, form.title.trim());
  saving.value = true;
  try {
    const payload = {
      title: form.title.trim(),
      content,
      categoryId: form.categoryId,
      published: form.published,
    };
    if (editId.value == null) {
      await createPost(payload);
      ElMessage.success("创建成功");
    } else {
      await updatePost(editId.value, payload);
      ElMessage.success("已保存");
    }
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

async function cancelEdit() {
  if (!(await confirmDiscardIfDirty())) return;
  void router.push({ name: "mine" });
}

onBeforeRouteLeave(async () => {
  if (saving.value) return true;
  return confirmDiscardIfDirty();
});
</script>

<template>
  <div v-loading="loading" class="post-editor-page">
    <div class="post-editor-layout">
      <div class="post-editor-layout__main">
        <header class="editor-head">
          <div class="editor-head__meta">
            <h1 class="editor-head__title">{{ pageTitle }}</h1>
            <p class="editor-head__sub">分享你的知识与见解，让更多开发者受益</p>
          </div>
          <button type="button" class="editor-head__back" @click="cancelEdit">← 返回列表</button>
        </header>

        <section class="editor-card editor-card--title">
          <el-form-item label="标题" class="editor-form-item--bleed">
            <el-input
              v-model="form.title"
              class="editor-title-input"
              maxlength="200"
              show-word-limit
              placeholder="起一个有信息量的标题"
            />
          </el-form-item>
        </section>

        <section class="editor-card editor-card--body yaniv-editor-host">
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
      </div>

      <aside class="post-editor-layout__side" aria-label="发布设置">
        <section class="side-panel">
          <h2 class="side-panel__title">发布设置</h2>

          <div class="side-panel__section">
            <h3 class="side-card-title">封面图</h3>
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
              class="cover-upload-placeholder"
              :disabled="coverUploading"
              @click="openCoverPicker"
              @dragover="onCoverDragOver"
              @drop="onCoverDrop"
            >
              {{ coverUploading ? "上传中…" : "点击或拖拽上传封面图" }}
            </button>
            <p class="side-card-hint">建议尺寸 1200x630，JPG/PNG 格式，大小不超过 5MB</p>
          </div>

          <div class="side-panel__section">
            <el-form-item label="选择栏目" class="side-form-item">
              <el-select
                v-model="form.categoryId"
                placeholder="选择栏目"
                filterable
                class="editor-select"
              >
                <el-option
                  v-for="o in leafOptions"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select>
            </el-form-item>
          </div>

          <div class="side-panel__section">
            <div class="publish-status-row" role="group" aria-label="发布状态切换">
              <span class="publish-status-row__label">发布状态</span>
              <div class="publish-status-toggle">
                <span class="publish-status-toggle__text" :class="{ 'is-active': !form.published }"
                  >存为草稿</span
                >
                <el-switch v-model="form.published" />
                <span class="publish-status-toggle__text" :class="{ 'is-active': form.published }"
                  >立即发布</span
                >
              </div>
            </div>
          </div>

          <div class="editor-actions">
            <el-button size="large" class="editor-actions__cancel" @click="cancelEdit"
              >取消</el-button
            >
            <el-button
              type="primary"
              size="large"
              class="editor-actions__primary"
              :loading="saving"
              @click="save"
            >
              {{ saveButtonLabel }}
            </el-button>
          </div>
          <p v-if="autosaveHintText" class="autosave-hint">{{ autosaveHintText }}</p>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
$border: #e8ecf3;
$radius-md: 12px;
$radius-lg: 14px;
$stroke: #e3e8f1;
$text-main: #1f2329;
$text-sub: #6b7280;
$text-muted: #9aa3b2;
$surface: #ffffff;
$surface-soft: #fafbfd;
$shadow-soft: none;

.post-editor-page {
  box-sizing: border-box;
  height: 100dvh;
  padding: 14px 20px;
  overflow: hidden;
  background: #f7f8fb;
}

.post-editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  max-width: 1320px;
  height: 100%;
  margin: 0 auto;
}

.post-editor-layout__main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 2px 2px 0;
}

.editor-head__title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  color: $text-main;
}

.editor-head__sub {
  margin: 8px 0 0;
  font-size: 13px;
  font-weight: 500;
  color: $text-sub;
}

.editor-head__back {
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 600;
  color: #5a6477;
  cursor: pointer;
  background: $surface;
  border: 1px solid $stroke;
  border-radius: 10px;
}

.editor-card {
  background: $surface;
  border: 1px solid $stroke;
  border-radius: $radius-lg;
  box-shadow: $shadow-soft;
}

.editor-card--title {
  padding: 14px 16px;
}

:deep(.editor-form-item--bleed.el-form-item) {
  display: flex;
  align-items: center;
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  margin-bottom: 0;
  font-size: 14px;
  font-weight: 700;
  color: $text-main;
}

:deep(.editor-form-item--bleed .el-form-item__content) {
  flex: 1;
}

.editor-title-input :deep(.el-input__wrapper) {
  min-height: 46px;
  padding: 0 16px;
  font-size: 15px;
  border-radius: $radius-md;
  box-shadow: 0 0 0 1px $stroke inset;
}

.editor-title-input :deep(.el-input__count) {
  font-size: 12px;
  color: $text-muted;
}

.editor-card--body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-top: 1px solid $stroke;
}

.editor-card--body.yaniv-editor-host :deep(.yaniv-editor) {
  flex: 1;
  min-height: 0;

  --ye-bg-secondary: #{$surface};
  --ye-bg: #{$surface};
  --ye-toolbar-bg: #{$surface};
  --ye-border: #{$stroke};
  --ye-toolbar-border: #{$stroke};
  --ye-footer-bg: #ffffff;
  --ye-footer-text: #7f8a9d;
  --ye-footer-divider: #{$stroke};
}

.editor-card--body.yaniv-editor-host :deep(.ye-toolbar),
.editor-card--body.yaniv-editor-host :deep(.ye-footer),
.editor-card--body.yaniv-editor-host :deep(.ye-toolbar-section) {
  border-color: $stroke;
}

.editor-card--body.yaniv-editor-host :deep(.ye-footer) {
  color: #7f8a9d;
  background: #fafbfd;
}

.editor-card--body.yaniv-editor-host :deep(.footer-nav-container),
.editor-card--body.yaniv-editor-host :deep(.footer-nav),
.editor-card--body.yaniv-editor-host :deep(.footer-nav__inner) {
  background: #fafbfd !important;
}

.editor-card--body.yaniv-editor-host :deep(.footer-nav-container),
.editor-card--body.yaniv-editor-host :deep(.footer-nav *) {
  color: #7f8a9d !important;
}

.editor-card--body.yaniv-editor-host :deep(.zoom-controls--bottom) {
  background: #ffffff !important;
  border-top: 1px solid $stroke !important;
  border-bottom: 0 !important;
  box-shadow: none !important;
}

.editor-card--body.yaniv-editor-host :deep(.zoom-controls--bottom .zoom-level),
.editor-card--body.yaniv-editor-host :deep(.zoom-controls--bottom .page-info),
.editor-card--body.yaniv-editor-host :deep(.zoom-controls--bottom .char-count),
.editor-card--body.yaniv-editor-host :deep(.zoom-controls--bottom .shortcut-hints) {
  color: #7f8a9d !important;
  border-color: $stroke !important;
}

.editor-card--body.yaniv-editor-host :deep(.zoom-controls.zoom-controls--bottom) {
  border-bottom: 0 !important;
}

.editor-card--body.yaniv-editor-host :deep(.ye-toolbar button),
.editor-card--body.yaniv-editor-host :deep(.ye-toolbar .ye-select-trigger) {
  border-radius: 8px;
}

.editor-card--body.yaniv-editor-host :deep(.ye-toolbar button:hover),
.editor-card--body.yaniv-editor-host :deep(.ye-toolbar .ye-select-trigger:hover) {
  background: #f6f8fb;
}

.post-editor-layout__side {
  display: block;
  margin-top: 74px;
}

.side-panel {
  position: sticky;
  top: 0;
  padding: 18px;
  background: $surface;
  border: 1px solid $border;
  border-radius: $radius-lg;
  box-shadow: $shadow-soft;
}

.side-panel__title {
  margin: 0 0 14px;
  font-size: 17px;
  font-weight: 700;
  color: $text-main;
}

.side-panel__section {
  margin-bottom: 16px;
}

.side-panel__section:last-of-type {
  margin-bottom: 10px;
}

.side-card-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: $text-sub;
  letter-spacing: 0.2px;
}

.side-panel__section:nth-of-type(3) .side-card-title {
  display: none;
}

.cover-file-input {
  display: none;
}

.cover-upload-placeholder {
  width: 100%;
  min-height: 128px;
  font-size: 13px;
  color: $text-muted;
  cursor: pointer;
  background: $surface-soft;
  border: 1px dashed #dce3ef;
  border-radius: $radius-md;

  &:disabled {
    cursor: wait;
    opacity: 0.7;
  }
}

.cover-preview {
  overflow: hidden;
  border: 1px solid $stroke;
  border-radius: $radius-md;
}

.cover-preview__img {
  display: block;
  width: 100%;
  max-height: 160px;
  object-fit: cover;
}

.cover-preview__actions {
  display: flex;
  gap: 8px;
  padding: 10px;
  background: $surface-soft;
}

.side-card-hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: $text-muted;
}

.side-form-item {
  margin-bottom: 0;
}

.publish-status-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #f8fafd;
  border: 1px solid #e6ecf5;
  border-radius: 10px;
}

.publish-status-row__label {
  font-size: 14px;
  font-weight: 700;
  color: $text-main;
}

.publish-status-toggle {
  display: inline-flex;
  gap: 10px;
  align-items: center;
}

.publish-status-toggle__text {
  font-size: 14px;
  font-weight: 600;
  color: #7f8a9d;
  transition: color 0.2s ease;
}

.publish-status-toggle__text.is-active {
  color: #2b84f6;
}

.publish-status-toggle :deep(.el-switch) {
  --el-switch-on-color: #2b84f6;
  --el-switch-off-color: #c5cbd6;
}

:deep(.side-form-item.el-form-item) {
  display: flex;
  align-items: center;
}

:deep(.side-form-item .el-form-item__label) {
  margin-bottom: 0;
}

:deep(.side-form-item .el-form-item__content) {
  flex: 1;
}

.editor-select {
  width: 100%;
}

.editor-select :deep(.el-select__wrapper) {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  box-shadow: 0 0 0 1px $stroke inset;
}

.editor-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 14px;
}

.editor-actions :deep(.el-button) {
  width: 100%;
  height: 44px;
  margin: 0;
  font-size: 15px;
  border-radius: 10px;
}

.editor-actions__cancel {
  color: #4b5568;
  border: 1px solid $stroke;
}

.editor-actions__primary {
  font-weight: 600;
  background: #2b84f6;
  border: 0;
}

.autosave-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #7a8ea8;
  text-align: center;
}

@media (width < 920px) {
  .post-editor-page {
    height: auto;
    min-height: 100dvh;
    overflow: auto;
  }

  .post-editor-layout {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 0;
  }

  .post-editor-layout__main {
    min-height: 60vh;
  }

  .post-editor-layout__side {
    display: block;
    margin-top: 0;
  }

  .side-panel {
    position: static;
  }
}
</style>
