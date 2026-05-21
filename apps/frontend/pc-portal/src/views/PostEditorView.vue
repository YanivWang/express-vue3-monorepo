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
import { ElMessage } from "element-plus";
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { fetchCategories } from "@/api/categories";
import { createPost, fetchPostForEditor, updatePost } from "@/api/posts";
import type { CategoryTreeNode, PostItem } from "@/api/types";
import { usePostMediaUpload } from "@/utils/usePostMediaUpload";

const EDITOR_ROUTE_LOCK_CLASS = "editor-route-lock";

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
const editorRef = ref<InstanceType<typeof YanivEditor> | null>(null);
const editorInitialContent = ref("<p></p>");

const form = reactive({
  title: "",
  categoryId: null as number | null,
  published: false,
});

const { handleUploadImage, handleUploadVideo } = usePostMediaUpload();

const editId = computed(() => {
  const raw = route.params.id;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
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

function lockEditorRouteScroll() {
  document.documentElement.classList.add(EDITOR_ROUTE_LOCK_CLASS);
}

function unlockEditorRouteScroll() {
  document.documentElement.classList.remove(EDITOR_ROUTE_LOCK_CLASS);
}

async function hydrateCategories() {
  const { categories: tree } = await fetchCategories();
  categories.value = tree;
}

function applyPost(p: PostItem) {
  form.title = p.title;
  form.categoryId = p.categoryId;
  form.published = p.published;
  editorInitialContent.value = p.content?.trim() || "<p></p>";
}

onMounted(async () => {
  lockEditorRouteScroll();
  loading.value = true;
  try {
    await hydrateCategories();
    if (editId.value != null) {
      const p = await fetchPostForEditor(editId.value);
      applyPost(p);
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
    await router.push({ name: "mine" });
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  unlockEditorRouteScroll();
});

function getEditorContentHtml(): string {
  return editorRef.value?.getHTML()?.trim() ?? "";
}

function getEditorPlainText(): string {
  return editorRef.value?.getText()?.trim() ?? "";
}

async function save() {
  const content = getEditorContentHtml();
  const plain = getEditorPlainText();
  if (!form.title.trim() || !plain) {
    ElMessage.warning("标题与正文不能为空");
    return;
  }
  if (form.categoryId == null) {
    ElMessage.warning("请选择分类（须为二级叶子）");
    return;
  }
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
    await router.push({ name: "mine" });
  } finally {
    saving.value = false;
  }
}

function cancelEdit() {
  void router.push({ name: "mine" });
}
</script>

<template>
  <div v-loading="loading" class="post-editor-page">
    <el-form label-position="top" class="post-editor-form">
      <aside class="editor-publish-bar" aria-label="发布设置">
        <el-form-item label="分类" class="editor-publish-bar__field">
          <el-select
            v-model="form.categoryId"
            placeholder="选择栏目"
            filterable
            class="editor-select"
          >
            <el-option v-for="o in leafOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>

        <el-form-item
          label="发布"
          class="editor-publish-bar__field editor-publish-bar__field--switch"
        >
          <el-switch
            v-model="form.published"
            active-text="立即发布"
            inactive-text="草稿"
            class="editor-switch"
          />
        </el-form-item>

        <div class="editor-actions editor-publish-bar__actions">
          <el-button
            type="primary"
            size="large"
            class="editor-actions__primary"
            :loading="saving"
            @click="save"
          >
            保存
          </el-button>
          <el-button size="large" @click="cancelEdit">取消</el-button>
        </div>
      </aside>

      <div class="post-editor-layout">
        <div class="post-editor-layout__main">
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
            />
          </section>
        </div>

        <aside class="post-editor-layout__side" aria-label="发布设置">
          <section class="editor-card">
            <el-form-item label="分类">
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
          </section>

          <section class="editor-card editor-card--footer">
            <el-form-item label="发布">
              <el-switch
                v-model="form.published"
                active-text="立即发布"
                inactive-text="草稿"
                class="editor-switch"
              />
            </el-form-item>
            <div class="editor-actions">
              <el-button
                type="primary"
                size="large"
                class="editor-actions__primary"
                :loading="saving"
                @click="save"
              >
                保存
              </el-button>
              <el-button size="large" @click="cancelEdit">取消</el-button>
            </div>
          </section>
        </aside>
      </div>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
$border: #e8e9ec;

.post-editor-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  min-height: 100vh;
  padding: 12px 16px;
  overflow: hidden;
  background: #f6f7f9;
}

.post-editor-form {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.editor-publish-bar {
  display: none;
}

.post-editor-layout {
  display: grid;
  flex: 1;
  gap: 12px;
  min-height: 0;

  @media (width >= 920px) {
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 16px;
  }
}

.post-editor-layout__main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.post-editor-layout__side {
  display: none;
  flex-direction: column;
  gap: 12px;

  @media (width >= 920px) {
    display: flex;
    align-self: start;
  }
}

@media (width < 920px) {
  .editor-publish-bar {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: flex-end;
    padding: 12px;
    margin-bottom: 8px;
    background: #fff;
    border: 1px solid $border;
    border-radius: 12px;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
  }

  .editor-publish-bar__field {
    flex: 1 1 160px;
    min-width: 0;
    margin-bottom: 0 !important;
  }

  .editor-publish-bar__field--switch {
    flex: 0 1 auto;
  }

  .editor-publish-bar__actions {
    flex: 1 1 100%;
    justify-content: flex-end;
    padding-top: 0;
  }
}

.editor-card {
  padding: 16px 16px 4px;
  background: #fff;
  border: 1px solid $border;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
}

.editor-card--title {
  flex-shrink: 0;
  padding-bottom: 8px;
}

.editor-card--body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  background: transparent;
  border: none;
  box-shadow: none;
}

.editor-card--body.yaniv-editor-host {
  height: 100%;
}

.editor-card--body.yaniv-editor-host :deep(.yaniv-editor) {
  flex: 1;
  min-height: 0;
}

.editor-card--footer {
  padding-bottom: 16px;
}

.post-editor-form {
  :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  :deep(.el-form-item__label) {
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #333;
  }
}

.editor-title-input {
  :deep(.el-input__wrapper) {
    padding: 10px 14px;
    font-size: 16px;
    border-radius: 10px;
    box-shadow: 0 0 0 1px #e4e5e8 inset;
  }
}

.editor-select {
  width: 100%;

  :deep(.el-select__wrapper) {
    min-height: 40px;
    padding: 4px 12px;
    border-radius: 10px;
    box-shadow: 0 0 0 1px #e4e5e8 inset;
  }
}

.editor-switch {
  :deep(.el-switch__label) {
    font-size: 13px;
    color: #555;
  }
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 4px;
}

.editor-actions__primary {
  min-width: 112px;
  font-weight: 500;
  border-radius: 999px;
}
</style>
