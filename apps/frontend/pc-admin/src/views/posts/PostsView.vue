<script setup lang="ts">
import { Delete, Edit, Search } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { fetchCategories } from "@/api/categories";
import { fetchPortalUsers } from "@/api/portalUsers";
import {
  fetchAdminPost,
  fetchAdminPostsList,
  deletePost as httpDeletePost,
  updatePost as httpPutPost,
} from "@/api/posts";
import type { CategoryTreeNode, PostItem } from "@/api/types";
import { useAuthStore } from "@/stores/auth";
import { hasAnyPermission } from "@/utils/permissions";

function flattenLeaves(nodes: CategoryTreeNode[], prefix = ""): { label: string; id: number }[] {
  const out: { label: string; id: number }[] = [];
  for (const n of nodes) {
    const label = prefix ? `${prefix} / ${n.name}` : n.name;
    if (n.children?.length) {
      out.push(...flattenLeaves(n.children, label));
    } else if (n.parentId != null) {
      out.push({ id: n.id, label });
    }
  }
  return out;
}

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const loading = ref(false);
const rows = ref<PostItem[]>([]);
const pagination = reactive({ page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false });
const leafOptions = ref<{ id: number; label: string }[]>([]);
const filters = reactive<{
  q: string;
  published: undefined | boolean;
  categoryId?: number;
  authorId?: number;
}>({
  q: "",
  published: undefined,
  categoryId: undefined,
  authorId: undefined,
});

const dlg = reactive({
  visible: false,
  row: null as PostItem | null,
  saving: false,
  form: {
    title: "",
    content: "",
    categoryId: undefined as unknown as number,
    published: true,
  },
});

const remoteAuthors = ref<{ id: number; username: string }[]>([]);

const perm = computed(() => auth.permissions);
const canWrite = computed(() => hasAnyPermission(perm.value, ["admin.posts.write"]));

async function reloadTree() {
  const { categories } = await fetchCategories();
  leafOptions.value = flattenLeaves(categories ?? []);
}

async function reloadList() {
  loading.value = true;
  try {
    const q: Record<string, unknown> = {
      page: pagination.page,
      limit: pagination.limit,
    };
    if (filters.q.trim()) q.q = filters.q.trim();
    if (filters.published !== undefined) q.published = filters.published;
    if (filters.categoryId) q.categoryId = filters.categoryId;
    if (filters.authorId) q.authorId = filters.authorId;
    const res = await fetchAdminPostsList(q);
    rows.value = res.posts;
    Object.assign(pagination, res.pagination);
  } finally {
    loading.value = false;
  }
}

async function remoteSearchAuthors(qs: string) {
  const { users } = await fetchPortalUsers({ page: 1, limit: 40, q: qs });
  remoteAuthors.value = users.map((u) => ({ id: u.id, username: u.username }));
}

async function openEdit(row: PostItem & { author?: unknown; category?: unknown }) {
  if (!canEditRow(row)) {
    ElMessage.warning("无权编辑或不具备写权限");
    return;
  }
  const { post } = await fetchAdminPost(row.id);
  dlg.row = post;
  dlg.form.title = post.title;
  dlg.form.content = post.content;
  dlg.form.categoryId = post.categoryId;
  dlg.form.published = post.published;
  dlg.visible = true;
}

function canEditRow(row: PostItem) {
  if (canWrite.value) return true;
  return row.authorId === auth.userId;
}

function canDeleteRow(row: PostItem) {
  if (hasAnyPermission(perm.value, ["admin.posts.delete"])) return true;
  return row.authorId === auth.userId;
}

async function saveEdit() {
  if (!dlg.row) return;
  dlg.saving = true;
  try {
    await httpPutPost(dlg.row.id, {
      title: dlg.form.title,
      content: dlg.form.content,
      categoryId: dlg.form.categoryId,
      published: dlg.form.published,
    });
    dlg.visible = false;
    await reloadList();
    ElMessage.success("已保存");
  } finally {
    dlg.saving = false;
  }
}

async function rm(row: PostItem) {
  if (!canDeleteRow(row)) return;
  await ElMessageBox.confirm("确定删除该文章？", "删除确认");
  await httpDeletePost(row.id);
  await reloadList();
}

function gotoComments(pid: number) {
  router.push({ path: "/comments", query: { postId: String(pid) } });
}

onMounted(async () => {
  await reloadTree().catch(() => undefined);
  await reloadList().catch(() => undefined);
});

function onPublishedQuick(row: PostItem, published: boolean) {
  httpPutPost(row.id, { published }).then(async () => {
    await reloadList();
    ElMessage.success("已更新发布状态");
  });
}
</script>

<template>
  <div>
    <el-form :inline="true" class="toolbar" @submit.prevent="reloadList">
      <el-form-item label="关键词">
        <el-input v-model="filters.q" clearable placeholder="标题/正文" style="width: 200px" />
      </el-form-item>
      <el-form-item label="公开">
        <el-select v-model="filters.published" clearable placeholder="全部" style="width: 120px">
          <el-option :value="true" label="已发布" />
          <el-option :value="false" label="未发布" />
        </el-select>
      </el-form-item>
      <el-form-item label="叶子分类">
        <el-select
          v-model="filters.categoryId"
          clearable
          filterable
          placeholder="选择"
          style="width: 220px"
        >
          <el-option v-for="c in leafOptions" :key="c.id" :label="c.label" :value="c.id" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="hasAnyPermission(perm, ['admin.portal_users.read'])" label="作者">
        <el-select
          v-model="filters.authorId"
          clearable
          filterable
          remote
          :remote-method="remoteSearchAuthors"
          placeholder="搜索注册用户"
          style="width: 220px"
        >
          <el-option v-for="a in remoteAuthors" :key="a.id" :label="a.username" :value="a.id" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :icon="Search" native-type="submit">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="rows" stripe>
      <el-table-column prop="id" label="ID" width="72" />
      <el-table-column prop="title" label="标题" min-width="200" />
      <el-table-column label="分类" width="120">
        <template #default="{ row }">{{ (row.category as any)?.name ?? "-" }}</template>
      </el-table-column>
      <el-table-column label="作者" width="120">
        <template #default="{ row }">{{ (row.author as any)?.username ?? row.authorId }}</template>
      </el-table-column>
      <el-table-column label="发布" width="100">
        <template #default="{ row }">
          <el-switch
            :disabled="!(canWrite || row.authorId === auth.userId)"
            :model-value="row.published"
            @change="(v: boolean) => onPublishedQuick(row, v)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            :icon="Edit"
            :disabled="!canEditRow(row)"
            @click="openEdit(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="hasAnyPermission(perm, ['admin.comments.read'])"
            link
            type="primary"
            @click="gotoComments(row.id)"
          >
            管理评论
          </el-button>
          <el-button
            link
            type="danger"
            :icon="Delete"
            :disabled="!canDeleteRow(row)"
            @click="rm(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="margin-top: 12px">
      <el-pagination
        v-model:current-page="pagination.page"
        :page-size="pagination.limit"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="reloadList"
      />
    </div>

    <el-dialog v-model="dlg.visible" title="编辑帖子" width="760px">
      <el-form label-width="90px">
        <el-form-item label="标题"><el-input v-model="dlg.form.title" /></el-form-item>
        <el-form-item label="正文"
          ><el-input v-model="dlg.form.content" type="textarea" :rows="8"
        /></el-form-item>
        <el-form-item label="叶子分类">
          <el-select v-model="dlg.form.categoryId" filterable style="width: 100%">
            <el-option v-for="c in leafOptions" :key="c.id" :label="c.label" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="发布"><el-switch v-model="dlg.form.published" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlg.visible = false">取消</el-button>
        <el-button type="primary" :loading="dlg.saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.toolbar {
  margin-bottom: 12px;
}
</style>
