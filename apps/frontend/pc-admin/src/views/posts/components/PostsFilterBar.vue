<script setup lang="ts">
import { Search } from "@element-plus/icons-vue";

import type { LeafCategoryOption } from "../composables/useLeafCategories";

defineProps<{
  leafOptions: LeafCategoryOption[];
  /** 仅当有 admin.portal_users.read 时才允许按作者筛选 */
  canFilterByAuthor: boolean;
  authorOptions: { id: number; username: string }[];
}>();

defineEmits<{
  search: [];
  searchAuthors: [keyword: string];
}>();

// 逐项 v-model 而不是整个 filters 对象传进来：props 是只读的，
// 直接改传进来的对象会绕过父组件的数据流（vue/no-mutating-props）
const keyword = defineModel<string>("keyword", { required: true });
const published = defineModel<boolean | undefined>("published");
const categoryId = defineModel<number | undefined>("categoryId");
const authorId = defineModel<number | undefined>("authorId");
</script>

<template>
  <el-form :inline="true" class="toolbar" @submit.prevent="$emit('search')">
    <el-form-item label="关键词">
      <el-input v-model="keyword" clearable placeholder="标题/正文" style="width: 200px" />
    </el-form-item>
    <el-form-item label="公开">
      <el-select v-model="published" clearable placeholder="全部" style="width: 120px">
        <el-option :value="true" label="已发布" />
        <el-option :value="false" label="未发布" />
      </el-select>
    </el-form-item>
    <el-form-item label="叶子分类">
      <el-select v-model="categoryId" clearable filterable placeholder="选择" style="width: 220px">
        <el-option v-for="c in leafOptions" :key="c.id" :label="c.label" :value="c.id" />
      </el-select>
    </el-form-item>
    <el-form-item v-if="canFilterByAuthor" label="作者">
      <el-select
        v-model="authorId"
        clearable
        filterable
        remote
        :remote-method="(kw: string) => $emit('searchAuthors', kw)"
        placeholder="搜索注册用户"
        style="width: 220px"
      >
        <el-option v-for="a in authorOptions" :key="a.id" :label="a.username" :value="a.id" />
      </el-select>
    </el-form-item>
    <el-form-item>
      <el-button type="primary" :icon="Search" native-type="submit">查询</el-button>
    </el-form-item>
  </el-form>
</template>

<style scoped lang="scss">
.toolbar {
  margin-bottom: 12px;
}
</style>
