<script setup lang="ts">
import { fetchCategories } from "@/api/categories";
import { createPost, fetchPostForEditor, updatePost } from "@/api/posts";
import { uploadImages } from "@/api/uploads";
import type { CategoryTreeNode, PostItem } from "@/api/types";
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

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
  <div v-loading="loading" class="editor">
    <h1>{{ editId == null ? "写文章" : "编辑文章" }}</h1>
    <el-form label-position="top">
      <el-form-item label="标题">
        <el-input v-model="form.title" maxlength="200" show-word-limit />
      </el-form-item>
      <el-form-item label="分类">
        <el-select v-model="form.categoryId" placeholder="选择栏目" filterable style="width: 100%">
          <el-option v-for="o in leafOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="正文">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="16"
          placeholder="支持纯文本；勿粘贴不可信 HTML。"
        />
      </el-form-item>
      <el-form-item label="配图">
        <div class="img-row">
          <el-button :loading="uploadBusy" @click="fileRef?.click()">上传图片</el-button>
          <input
            ref="fileRef"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            hidden
            @change="onFileChange"
          />
          <span class="hint">最多 24 张，单次上传最多 12 个文件</span>
        </div>
        <div class="thumbs">
          <div v-for="(src, i) in images" :key="src + i" class="thumb">
            <img :src="src" alt="" />
            <el-button class="rm" size="small" circle @click="removeImage(i)">×</el-button>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="发布">
        <el-switch v-model="form.published" active-text="立即发布" inactive-text="草稿" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        <el-button @click="router.push({ name: 'mine' })">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
.editor {
  padding: 24px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
}

.editor h1 {
  margin: 0 0 20px;
  font-size: 22px;
}

.img-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.hint {
  font-size: 12px;
  color: #999;
}

.thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.thumb {
  position: relative;
  width: 120px;
  height: 120px;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.rm {
  position: absolute;
  top: 4px;
  right: 4px;
}
</style>
