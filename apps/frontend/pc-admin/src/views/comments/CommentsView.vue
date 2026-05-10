<script setup lang="ts">
import { ElMessageBox } from "element-plus";
import { computed, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";

import type { AdminCommentRow } from "@/api/comments";
import { deleteComment as deleteCommentHttp, fetchAdminComments } from "@/api/comments";
import type { Pagination } from "@/api/types";
import { useAuthStore } from "@/stores/auth";
import { hasAnyPermission } from "@/utils/permissions";

const auth = useAuthStore();
const route = useRoute();
const loading = ref(false);
const rows = ref<(AdminCommentRow & { excerpt?: string })[]>([]);
const pagination = reactive<Pagination>({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
  hasNext: false,
});
const filters = reactive<{ postId?: number; authorId?: number; q: string }>({
  q: "",
  postId: undefined,
  authorId: undefined,
});

const perm = computed(() => auth.permissions);
const canDel = computed(() => hasAnyPermission(perm.value, ["admin.comments.delete"]));

watch(
  () => route.query.postId,
  (v) => {
    filters.postId = v ? Number(v) : undefined;
    void load();
  },
  { immediate: true },
);

async function load() {
  loading.value = true;
  try {
    const q: Record<string, unknown> = { page: pagination.page, limit: pagination.limit };
    if (filters.q.trim()) q.q = filters.q.trim();
    if (filters.postId) q.postId = filters.postId;
    if (filters.authorId) q.authorId = filters.authorId;
    const res = await fetchAdminComments(q);
    rows.value = res.comments;
    Object.assign(pagination, res.pagination);
  } finally {
    loading.value = false;
  }
}

async function removeRow(row: AdminCommentRow) {
  await ElMessageBox.confirm("删除该评论？", "确认");
  await deleteCommentHttp(row.postId, row.id);
  await load();
}
</script>

<template>
  <div>
    <el-form :inline="true" @submit.prevent="load">
      <el-form-item label="帖子 id">
        <el-input-number v-model="filters.postId" :min="1" controls-position="right" />
      </el-form-item>
      <el-form-item label="作者 id">
        <el-input-number v-model="filters.authorId" :min="1" controls-position="right" />
      </el-form-item>
      <el-form-item label="正文">
        <el-input v-model="filters.q" clearable placeholder="关键字" />
      </el-form-item>
      <el-form-item><el-button type="primary" native-type="submit">查询</el-button></el-form-item>
    </el-form>
    <el-table v-loading="loading" :data="rows" stripe>
      <el-table-column prop="id" label="评论" width="80" />
      <el-table-column label="预览" min-width="220">
        <template #default="{ row }">
          <el-tooltip :content="row.content">
            {{ row.contentExcerpt ?? row.content?.slice(0, 160) }}
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="authorId" label="作者" width="88" />
      <el-table-column prop="postId" label="帖子" width="80" />
      <el-table-column label="帖子标题">
        <template #default="{ row }">{{ row.postTitle ?? "-" }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button
            link
            type="danger"
            :disabled="!canDel"
            @click="removeRow(row as AdminCommentRow)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="pagination.page"
      style="margin-top: 12px"
      :page-size="pagination.limit"
      :total="pagination.total"
      layout="total, prev, pager, next"
      @current-change="load"
    />
  </div>
</template>
