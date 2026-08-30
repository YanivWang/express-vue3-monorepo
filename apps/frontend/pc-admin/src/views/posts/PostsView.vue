<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { fetchPortalUsers } from "@/api/portalUsers";
import { deletePost as httpDeletePost, updatePost as httpPutPost } from "@/api/posts";
import type { PostItem } from "@/api/types";
import PostEditDialog from "@/views/posts/components/PostEditDialog.vue";
import PostsFilterBar from "@/views/posts/components/PostsFilterBar.vue";
import PostsTable from "@/views/posts/components/PostsTable.vue";
import { useLeafCategories } from "@/views/posts/composables/useLeafCategories";
import { usePostEditDialog } from "@/views/posts/composables/usePostEditDialog";
import { usePostPermissions } from "@/views/posts/composables/usePostPermissions";
import { usePostsList } from "@/views/posts/composables/usePostsList";

/**
 * 后台文章管理：只负责编排。
 *
 * 列表与筛选、叶子分类、逐行权限、编辑对话框各自成 composable，
 * 筛选栏 / 表格 / 对话框各自成组件。
 */

const router = useRouter();

const { loading, rows, pagination, filters, reloadList } = usePostsList();
const { leafOptions, reloadTree } = useLeafCategories();
const { canReadComments, canFilterByAuthor, canEditRow, canDeleteRow } = usePostPermissions();
const dialog = usePostEditDialog(reloadList);

const remoteAuthors = ref<{ id: number; username: string }[]>([]);

async function searchAuthors(keyword: string) {
  const { users } = await fetchPortalUsers({ page: 1, limit: 40, q: keyword });
  remoteAuthors.value = users.map((u) => ({ id: u.id, username: u.username }));
}

async function openEdit(row: PostItem) {
  if (!canEditRow(row)) {
    ElMessage.warning("无权编辑或不具备写权限");
    return;
  }
  await dialog.open(row);
}

async function removeRow(row: PostItem) {
  if (!canDeleteRow(row)) return;
  try {
    await ElMessageBox.confirm("确定删除该文章？", "删除确认");
  } catch {
    // 用户点了取消：Element Plus 用 reject 表达取消，不接住会逃逸成
    // unhandled rejection（本仓库接了 web-monitor，会被当成线上错误上报）
    return;
  }
  await httpDeletePost(row.id);
  await reloadList();
}

function gotoComments(postId: number) {
  void router.push({ path: "/comments", query: { postId: String(postId) } });
}

async function onPublishedQuick(row: PostItem, published: boolean) {
  try {
    await httpPutPost(row.id, { published });
    ElMessage.success("已更新发布状态");
  } catch {
    /* 错误提示由 http 层统一弹出，这里只需保证下面的 reload 一定执行 */
  }
  // 成功时刷新计数与排序；失败时让 el-switch 回到服务端真实的 published 值
  await reloadList();
}

onMounted(async () => {
  await reloadTree().catch(() => undefined);
  await reloadList().catch(() => undefined);
});
</script>

<template>
  <div>
    <PostsFilterBar
      v-model:keyword="filters.q"
      v-model:published="filters.published"
      v-model:category-id="filters.categoryId"
      v-model:author-id="filters.authorId"
      :leaf-options="leafOptions"
      :can-filter-by-author="canFilterByAuthor"
      :author-options="remoteAuthors"
      @search="reloadList"
      @search-authors="searchAuthors"
    />

    <PostsTable
      :rows="rows"
      :loading="loading"
      :can-edit-row="canEditRow"
      :can-delete-row="canDeleteRow"
      :show-comments="canReadComments"
      @edit="openEdit"
      @remove="removeRow"
      @comments="gotoComments"
      @toggle-published="onPublishedQuick"
    />

    <div class="pager">
      <el-pagination
        v-model:current-page="pagination.page"
        :page-size="pagination.limit"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="reloadList"
      />
    </div>

    <PostEditDialog
      v-model:visible="dialog.visible.value"
      :post="dialog.editingPost.value"
      :saving="dialog.saving.value"
      :leaf-options="leafOptions"
      @save="dialog.save"
    />
  </div>
</template>

<style scoped lang="scss">
.pager {
  margin-top: 12px;
}
</style>
