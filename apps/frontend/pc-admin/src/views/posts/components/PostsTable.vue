<script setup lang="ts">
import { Delete, Edit } from "@element-plus/icons-vue";

import type { PostItem } from "@/api/types";

defineProps<{
  rows: PostItem[];
  loading: boolean;
  /** 逐行权限判定由上层注入，表格本身不认权限码 */
  canEditRow: (row: PostItem) => boolean;
  canDeleteRow: (row: PostItem) => boolean;
  showComments: boolean;
}>();

defineEmits<{
  edit: [row: PostItem];
  remove: [row: PostItem];
  comments: [postId: number];
  togglePublished: [row: PostItem, published: boolean];
}>();
</script>

<template>
  <el-table v-loading="loading" :data="rows" stripe>
    <el-table-column prop="id" label="ID" width="72" />
    <el-table-column prop="title" label="标题" min-width="200" />
    <el-table-column label="分类" width="120">
      <template #default="{ row }: { row: PostItem }">{{ row.category?.name ?? "-" }}</template>
    </el-table-column>
    <el-table-column label="作者" width="120">
      <template #default="{ row }: { row: PostItem }">
        {{ row.author?.username ?? row.authorId }}
      </template>
    </el-table-column>
    <el-table-column label="发布" width="100">
      <template #default="{ row }: { row: PostItem }">
        <el-switch
          :disabled="!canEditRow(row)"
          :model-value="row.published"
          @change="(v: boolean) => $emit('togglePublished', row, v)"
        />
      </template>
    </el-table-column>
    <el-table-column label="操作" width="280" fixed="right">
      <template #default="{ row }: { row: PostItem }">
        <el-button
          link
          type="primary"
          :icon="Edit"
          :disabled="!canEditRow(row)"
          @click="$emit('edit', row)"
        >
          编辑
        </el-button>
        <el-button v-if="showComments" link type="primary" @click="$emit('comments', row.id)">
          管理评论
        </el-button>
        <el-button
          link
          type="danger"
          :icon="Delete"
          :disabled="!canDeleteRow(row)"
          @click="$emit('remove', row)"
        >
          删除
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
