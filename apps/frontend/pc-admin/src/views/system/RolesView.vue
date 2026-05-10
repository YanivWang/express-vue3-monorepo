<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";

import type { PermissionDef, RoleAgg } from "@/api/roles";
import { createRole, deleteRole, fetchPermissionDefs, fetchRoles, patchRole } from "@/api/roles";
import { isDangerousPermission } from "@/utils/permissions";

const defs = ref<PermissionDef[]>([]);
const roles = ref<RoleAgg[]>([]);

const createDlg = reactive({ open: false, name: "", slug: "", isStaff: true });
const dlg = reactive({
  open: false,
  role: null as RoleAgg | null,
  checks: {},
  nameDraft: "",
  isStaffDraft: true,
});

const safeDefs = computed(() => defs.value.filter((d) => !isDangerousPermission(d.code)));
const dangerDefs = computed(() => defs.value.filter((d) => isDangerousPermission(d.code)));

async function loadAll() {
  const [pd, rl] = await Promise.all([fetchPermissionDefs(), fetchRoles()]);
  defs.value = pd.permissions;
  roles.value = rl.roles;
}

function syncChecksFrom(role: RoleAgg) {
  const next: Record<string, boolean> = {};
  for (const d of defs.value) next[d.code] = false;
  for (const p of role.permissions ?? []) next[p.code] = true;
  dlg.checks = next;
}

function openEdit(role: RoleAgg) {
  dlg.role = role;
  dlg.nameDraft = role.name;
  dlg.isStaffDraft = role.isStaff;
  syncChecksFrom(role);
  dlg.open = true;
}

async function submitMatrix() {
  if (!dlg.role) return;
  const codes = Object.entries(dlg.checks)
    .filter(([, v]) => v)
    .map(([k]) => k);
  await patchRole(dlg.role.id, {
    permissionCodes: codes,
    name: dlg.nameDraft,
    isStaff: dlg.isStaffDraft,
  });
  dlg.open = false;
  await loadAll();
  ElMessage.success("已保存权限矩阵");
}

async function rm(role: RoleAgg) {
  if (role.isSystem) return;
  await ElMessageBox.confirm("删除自定义角色？", "确认");
  await deleteRole(role.id);
  await loadAll();
}

async function submitCreate() {
  await createRole({
    name: createDlg.name,
    slug: createDlg.slug,
    isStaff: createDlg.isStaff,
  });
  createDlg.open = false;
  await loadAll();
}

function toggleGroup(list: PermissionDef[], on: boolean) {
  for (const d of list) dlg.checks[d.code] = on;
}

onMounted(loadAll);
</script>

<template>
  <div>
    <el-button type="primary" style="margin-bottom: 12px" @click="((createDlg.open = true), undefined)">
      新建自定义角色
    </el-button>
    <el-table :data="roles" stripe>
      <el-table-column prop="slug" label="slug" />
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="userCount" label="用户数" width="90" />
      <el-table-column label="职员" width="80">
        <template #default="{ row }">{{ row.isStaff ? "是" : "否" }}</template>
      </el-table-column>
      <el-table-column label="内置" width="80">
        <template #default="{ row }">{{ row.isSystem ? "是" : "否" }}</template>
      </el-table-column>
      <el-table-column label="权限数" width="90">
        <template #default="{ row }">{{ row.permissions?.length ?? 0 }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row as RoleAgg)">权限矩阵</el-button>
          <el-button link type="danger" :disabled="row.isSystem || row.userCount > 0" @click="rm(row as RoleAgg)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="createDlg.open" title="新建角色" width="480px">
      <el-input v-model="createDlg.name" placeholder="名称" />
      <el-input v-model="createDlg.slug" style="margin-top: 12px" placeholder="slug（如 comment_moderator）" />
      <el-switch v-model="createDlg.isStaff" style="margin-top: 12px" active-text="可登录后台" />
      <template #footer>
        <el-button @click="createDlg.open = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dlg.open" :title="`角色：${dlg.role?.slug}`" width="720px">
      <el-form label-width="100px">
        <el-form-item label="名称"><el-input v-model="dlg.nameDraft" /></el-form-item>
        <el-form-item label="职员身份"><el-switch v-model="dlg.isStaffDraft" /></el-form-item>
      </el-form>
      <el-divider />
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px">
        <span style="flex: 1 0 100%; font-weight: 600">一般权限</span>
        <el-button size="small" @click="toggleGroup(safeDefs, true)">全选</el-button>
        <el-button size="small" @click="toggleGroup(safeDefs, false)">清空</el-button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px">
        <el-checkbox v-for="d in safeDefs" :key="d.code" v-model="dlg.checks[d.code]">
          {{ d.code }}
        </el-checkbox>
      </div>
      <el-divider />
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px">
        <span style="flex: 1 0 100%; font-weight: 600; color: #dc2626">危险权限分组</span>
        <el-button size="small" @click="toggleGroup(dangerDefs, true)">全选</el-button>
        <el-button size="small" @click="toggleGroup(dangerDefs, false)">清空</el-button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px">
        <el-checkbox v-for="d in dangerDefs" :key="d.code" v-model="dlg.checks[d.code]">
          {{ d.code }}
        </el-checkbox>
      </div>
      <template #footer>
        <el-button @click="dlg.open = false">关闭</el-button>
        <el-button type="primary" @click="submitMatrix">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
