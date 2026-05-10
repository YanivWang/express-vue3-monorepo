<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { fetchCategories } from "@/api/categories";
import { createPost, fetchPostForEditor, updatePost } from "@/api/posts";
import type { CategoryTreeNode, PostItem } from "@/api/types";
import { uploadImages } from "@/api/uploads";

const route = useRoute();
const router = useRouter();

const categories = ref<CategoryTreeNode[]>([]);
const loading = ref(false);
const saving = ref(false);
const uploadBusy = ref(false);
const fileRef = ref<HTMLInputElement | null>(null);

const form = reactive({
  title: "",
  content: "",
  categoryId: null as number | null,
  published: false,
});

const images = ref<string[]>([]);
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

async function hydrateCategories() {
  const { categories: tree } = await fetchCategories();
  categories.value = tree;
}

function applyPost(p: PostItem) {
  form.title = p.title;
  form.content = p.content;
  form.categoryId = p.categoryId;
  form.published = p.published;
  images.value = [...(p.images ?? [])];
}

onMounted(async () => {
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

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (!files?.length) return;
  uploadBusy.value = true;
  try {
    const { urls } = await uploadImages(Array.from(files));
    images.value = [...images.value, ...urls].slice(0, 24);
    ElMessage.success("上传成功");
  } finally {
    uploadBusy.value = false;
    input.value = "";
  }
}

function removeImage(i: number) {
  images.value.splice(i, 1);
}

async function save() {
  if (!form.title.trim() || !form.content.trim()) {
    ElMessage.warning("标题与正文不能为空");
    return;
  }
  if (form.categoryId == null) {
    ElMessage.warning("请选择分类（须为二级叶子）");
    return;
  }
  saving.value = true;
  try {
    if (editId.value == null) {
      await createPost({
        title: form.title.trim(),
        content: form.content.trim(),
        categoryId: form.categoryId,
        published: form.published,
        images: images.value,
      });
      ElMessage.success("创建成功");
    } else {
      await updatePost(editId.value, {
        title: form.title.trim(),
        content: form.content.trim(),
        categoryId: form.categoryId,
        published: form.published,
        images: images.value,
      });
      ElMessage.success("已保存");
    }
    await router.push({ name: "mine" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-loading="loading" class="editor-page">
    <header class="editor-page__head">
      <button type="button" class="editor-back" @click="router.push({ name: 'mine' })">
        <span class="editor-back__arrow" aria-hidden="true">←</span>
        我的文章
      </button>
      <div class="editor-page__head-text">
        <h1 class="editor-page__title">{{ editId == null ? "写文章" : "编辑文章" }}</h1>
        <p class="editor-page__subtitle">
          纯文本正文，配图可选；保存后可在「我的文章」中继续修改。
        </p>
      </div>
    </header>

    <el-form label-position="top" class="editor-form">
      <div class="editor-layout">
        <div class="editor-layout__main">
          <section class="editor-card">
            <el-form-item label="标题" class="editor-form-item--bleed">
              <el-input
                v-model="form.title"
                class="editor-title-input"
                maxlength="200"
                show-word-limit
                placeholder="起一个有信息量的标题"
              />
            </el-form-item>
            <el-form-item label="正文" class="editor-form-item--bleed editor-form-item--body">
              <el-input
                v-model="form.content"
                type="textarea"
                :rows="14"
                class="editor-body-input"
                placeholder="支持纯文本；勿粘贴不可信 HTML。"
              />
            </el-form-item>
          </section>
        </div>

        <aside class="editor-layout__side">
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

          <section class="editor-card">
            <el-form-item label="配图" class="editor-form-item--images">
              <div class="upload-panel">
                <div class="upload-panel__actions">
                  <el-button :loading="uploadBusy" type="primary" plain @click="fileRef?.click()">
                    上传图片
                  </el-button>
                  <input
                    ref="fileRef"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    hidden
                    @change="onFileChange"
                  />
                </div>
                <p class="upload-panel__hint">最多 24 张，单次上传最多 12 个文件</p>
                <div v-if="images.length > 0" class="thumbs" role="list">
                  <div v-for="(src, i) in images" :key="src + i" class="thumb" role="listitem">
                    <img :src="src" alt="" />
                    <button
                      type="button"
                      class="thumb__remove"
                      aria-label="移除图片"
                      @click="removeImage(i)"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <p v-else class="upload-panel__empty">暂未添加配图</p>
              </div>
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
              <el-button size="large" @click="router.push({ name: 'mine' })">取消</el-button>
            </div>
          </section>
        </aside>
      </div>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
$brand: #ea6f5a;
$border: #e8e9ec;
$muted: #888;

.editor-page {
  margin: -8px 0 0;
}

.editor-page__head {
  margin-bottom: 20px;
}

.editor-back {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 4px 2px 12px;
  margin: 0 0 0 -2px;
  font-family: inherit;
  font-size: 14px;
  color: $muted;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 6px;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;

  &:hover {
    color: $brand;
    background-color: rgb(0 0 0 / 0.03);
  }

  &:focus-visible {
    outline: 2px solid rgb(234 111 90 / 0.45);
    outline-offset: 2px;
  }
}

.editor-back__arrow {
  font-size: 15px;
  line-height: 1;
  opacity: 0.85;
}

.editor-page__head-text {
  padding-bottom: 2px;
  border-bottom: 1px solid #eee;
}

.editor-page__title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.3;
  color: #222;
  letter-spacing: 0.02em;
}

.editor-page__subtitle {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.5;
  color: $muted;
}

.editor-layout {
  display: grid;
  gap: 20px;
  align-items: start;

  @media (width >= 920px) {
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 24px;
  }
}

.editor-layout__side {
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (width >= 920px) {
    position: sticky;
    top: 12px;
  }
}

.editor-card {
  padding: 18px 18px 4px;
  background: #fff;
  border: 1px solid $border;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
}

.editor-card--footer {
  padding-bottom: 18px;
}

.editor-form {
  :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  :deep(.el-form-item__label) {
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #333;
  }
}

.editor-form-item--bleed {
  :deep(.el-form-item__content) {
    line-height: 1.5;
  }
}

.editor-form-item--body {
  margin-bottom: 8px !important;
}

.editor-title-input {
  :deep(.el-input__wrapper) {
    padding: 10px 14px;
    font-size: 16px;
    border-radius: 10px;
    box-shadow: 0 0 0 1px #e4e5e8 inset;
  }

  :deep(.el-input__inner) {
    font-weight: 500;
    letter-spacing: 0.01em;
  }
}

.editor-body-input {
  :deep(.el-textarea__inner) {
    min-height: 360px;
    padding: 14px 16px;
    font-size: 15px;
    line-height: 1.65;
    color: #2a2a2a;
    resize: vertical;
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

.upload-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.upload-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.upload-panel__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: $muted;
}

.upload-panel__empty {
  padding: 12px 14px;
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: #b0b0b0;
  text-align: center;
  background: #fafbfc;
  border: 1px dashed #dcdde2;
  border-radius: 10px;
}

.thumbs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
  margin: 4px 0 0;
}

.thumb {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: #f3f4f6;
  border-radius: 8px;
}

.thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb__remove {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  margin: 0;
  font-size: 16px;
  line-height: 1;
  color: #fff;
  cursor: pointer;
  background: rgb(0 0 0 / 0.45);
  border: none;
  border-radius: 999px;
  transition: background 0.15s ease;

  &:hover {
    background: rgb(0 0 0 / 0.62);
  }

  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 1px;
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
  margin-top: 4px;
}

.editor-actions__primary {
  min-width: 112px;
  font-weight: 500;
  border-radius: 999px;
}
</style>
