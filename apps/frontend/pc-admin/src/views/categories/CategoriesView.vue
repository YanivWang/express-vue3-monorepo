<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { onMounted, reactive, ref } from "vue";

import {
  createLeafCategory,
  createRootCategory,
  deleteCategory,
  fetchCategories,
  patchCategory,
} from "@/api/categories";
import type { CategoryTreeNode } from "@/api/types";
import { useAuthStore } from "@/stores/auth";
import { hasAnyPermission } from "@/utils/permissions";

type Row = CategoryTreeNode & { children?: Row[] };

const auth = useAuthStore();
const perm = () => auth.permissions;
const loading = ref(false);
const tree = ref<Row[]>([]);

const rootDlg = reactive({ open: false, name: "", sortOrder: 0 });
const leafDlg = reactive({
  open: false,
  parentId: 0,
  parentName: "",
  name: "",
  sortOrder: 0,
});
const editDlg = reactive({ open: false, id: 0, name: "", sortOrder: 0 });

async function reload() {
  loading.value = true;
  try {
    const { categories } = await fetchCategories();
    tree.value = (categories ?? []);
  } finally {
    loading.value = false;
  }
}

function openLeaf(parent: Row) {
  leafDlg.parentId = parent.id;
  leafDlg.parentName = parent.name;
  leafDlg.name = "";
  leafDlg.sortOrder = 0;
  leafDlg.open = true;
}

async function submitRoot() {
  await createRootCategory({ name: rootDlg.name, sortOrder: rootDlg.sortOrder });
  rootDlg.open = false;
  await reload();
  ElMessage.success("已创建一级分类");
}

async function submitLeaf() {
  await createLeafCategory({
    parentId: leafDlg.parentId,
    name: leafDlg.name,
    sortOrder: leafDlg.sortOrder,
  });
  leafDlg.open = false;
  await reload();
  ElMessage.success("已创建二级分类");
}

function openEdit(node: Row) {
  editDlg.id = node.id;
  editDlg.name = node.name;
  editDlg.sortOrder = node.sortOrder ?? 0;
  editDlg.open = true;
}

async function submitEdit() {
  await patchCategory(editDlg.id, { name: editDlg.name, sortOrder: editDlg.sortOrder });
  editDlg.open = false;
  await reload();
}

async function remove(node: Row) {
  await ElMessageBox.confirm("确认删除？", "删除");
  await deleteCategory(node.id);
  await reload();
}

function isLeaf(n: Row) {
  return n.parentId != null;
}

function canWriteCat() {
  return hasAnyPermission(perm(), ["admin.categories.write"]);
}
function canDeleteCat() {
  return hasAnyPermission(perm(), ["admin.categories.delete"]);
}

onMounted(reload);
</script>

<template>
  <div>
    <el-space style="margin-bottom: 12px">
      <el-button v-if="canWriteCat()" type="primary" @click="((rootDlg.open = true), (rootDlg.name = ''))">
        新建一级分类
      </el-button>
    </el-space>
    <el-table
      v-loading="loading"
      row-key="id"
      :data="tree"
      :tree-props="{ children: 'children' }"
      default-expand-all
    >
      <el-table-column prop="name" label="名称" min-width="200" />
      <el-table-column prop="sortOrder" label="排序" width="120" />
      <el-table-column label="层级" width="100">
        <template #default="{ row }">{{ isLeaf(row) ? "二级叶子" : "一级" }}</template>
      </el-table-column>
      <el-table-column label="操作" width="340">
        <template #default="{ row }">
          <el-space>
            <el-button v-if="canWriteCat() && !isLeaf(row)" link type="primary" @click="openLeaf(row)">
              新建二级
            </el-button>
            <el-button v-if="canWriteCat()" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="canDeleteCat()" link type="danger" @click="remove(row)">删除</el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="rootDlg.open" title="新建一级分类" width="420px">
      <el-input v-model="rootDlg.name" placeholder="名称" />
      <el-input-number v-model="rootDlg.sortOrder" style="margin-top: 12px; width: 100%" />
      <template #footer>
        <el-button @click="rootDlg.open = false">取消</el-button>
        <el-button type="primary" @click="submitRoot">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="leafDlg.open" :title="`在「${leafDlg.parentName}」下新建二级`" width="420px">
      <el-input v-model="leafDlg.name" placeholder="名称" />
      <el-input-number v-model="leafDlg.sortOrder" style="margin-top: 12px; width: 100%" />
      <template #footer>
        <el-button @click="leafDlg.open = false">取消</el-button>
        <el-button type="primary" @click="submitLeaf">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDlg.open" title="编辑分类" width="420px">
      <el-input v-model="editDlg.name" />
      <el-input-number v-model="editDlg.sortOrder" style="margin-top: 12px; width: 100%" />
      <template #footer>
        <el-button @click="editDlg.open = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
