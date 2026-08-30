<script setup lang="ts">
import { reactive, watch } from "vue";

import type { PostItem } from "@/api/types";

import type { LeafCategoryOption } from "../composables/useLeafCategories";
import type { PostEditPayload } from "../types";

const props = defineProps<{
  /** 待编辑的文章；为 null 时对话框内容留空 */
  post: PostItem | null;
  saving: boolean;
  leafOptions: LeafCategoryOption[];
}>();

defineEmits<{ save: [payload: PostEditPayload] }>();

const visible = defineModel<boolean>("visible", { required: true });

// 对话框自己持有一份草稿：编辑中途取消不应该污染列表里的那一行
const form = reactive<PostEditPayload>({
  title: "",
  content: "",
  categoryId: undefined,
  published: true,
});

watch(
  () => props.post,
  (post) => {
    form.title = post?.title ?? "";
    form.content = post?.content ?? "";
    form.categoryId = post?.categoryId;
    form.published = post?.published ?? true;
  },
  { immediate: true },
);
</script>

<template>
  <el-dialog v-model="visible" title="编辑帖子" width="760px">
    <el-form label-width="90px">
      <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
      <el-form-item label="正文">
        <el-input v-model="form.content" type="textarea" :rows="8" />
      </el-form-item>
      <el-form-item label="叶子分类">
        <el-select v-model="form.categoryId" filterable style="width: 100%">
          <el-option v-for="c in leafOptions" :key="c.id" :label="c.label" :value="c.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="发布"><el-switch v-model="form.published" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="$emit('save', { ...form })">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>
