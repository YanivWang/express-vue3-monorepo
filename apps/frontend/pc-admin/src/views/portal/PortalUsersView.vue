<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { onMounted, reactive, ref } from "vue";

import { deletePortalUser, fetchPortalUsers, patchPortalUser } from "@/api/portalUsers";
import type { CurrentUserProfile, Pagination } from "@/api/types";
import { useAuthStore } from "@/stores/auth";
import { hasAnyPermission } from "@/utils/permissions";

const auth = useAuthStore();
const loading = ref(false);
const rows = ref<CurrentUserProfile[]>([]);
const pagination = reactive<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false });
const q = ref("");

const dlg = reactive({ open: false, row: null as CurrentUserProfile | null, username: "", avatar: "" });

async function load() {
  loading.value = true;
  try {
    const res = await fetchPortalUsers({ page: pagination.page, limit: pagination.limit, q: q.value.trim() });
    rows.value = res.users;
    Object.assign(pagination, res.pagination);
  } finally {
    loading.value = false;
  }
}

function open(row: CurrentUserProfile) {
  dlg.row = row;
  dlg.username = row.username;
  dlg.avatar = row.avatar ?? "";
  dlg.open = true;
}

async function save() {
  if (!dlg.row) return;
  await patchPortalUser(dlg.row.id, {
    username: dlg.username,
    avatar: dlg.avatar || null,
  });
  dlg.open = false;
  await load();
  ElMessage.success("已更新");
}

async function remove(row: CurrentUserProfile) {
  await ElMessageBox.confirm("永久删除该注册用户（受文章/评论 RESTRICT 约束）？", "删除");
  await deletePortalUser(row.id);
  await load();
}

onMounted(load);
</script>

<template>
  <div>
    <el-form inline @submit.prevent="load">
      <el-form-item label="搜索">
        <el-input v-model="q" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit">查询</el-button>
      </el-form-item>
    </el-form>
    <el-table v-loading="loading" :data="rows" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="username" label="用户名" />
      <el-table-column prop="avatar" label="头像 URL" />
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            :disabled="!hasAnyPermission(auth.permissions, ['admin.portal_users.write'])"
            @click="open(row as CurrentUserProfile)"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            :disabled="!hasAnyPermission(auth.permissions, ['admin.portal_users.delete'])"
            @click="remove(row as CurrentUserProfile)"
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
    <el-dialog v-model="dlg.open" title="编辑注册用户">
      <el-form label-width="80px">
        <el-form-item label="用户名"><el-input v-model="dlg.username" /></el-form-item>
        <el-form-item label="头像"><el-input v-model="dlg.avatar" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlg.open = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
