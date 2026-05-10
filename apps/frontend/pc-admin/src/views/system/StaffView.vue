<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";

import {
  createStaff,
  fetchStaffList,
  fetchStaffRoleOptions,
  patchStaff,
  revokeStaff,
} from "@/api/staff";
import type { StaffRow } from "@/api/staff";
import type { Pagination } from "@/api/types";
import { useAuthStore } from "@/stores/auth";
import { hasAnyPermission } from "@/utils/permissions";

const auth = useAuthStore();

const loading = ref(false);
const rows = ref<StaffRow[]>([]);
const pagination = reactive<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false });
const q = ref("");

const roles = ref<{ id: number; name: string; slug: string }[]>([]);

const createDlg = reactive({ open: false, username: "", password: "", roleId: undefined as number | undefined });
const patchDlg = reactive({
  open: false,
  row: null as StaffRow | null,
  username: "",
  password: "",
  roleId: undefined as number | undefined,
});

const canInvite = computed(() => hasAnyPermission(auth.permissions, ["admin.staff.invite"]));
const canWrite = computed(() => hasAnyPermission(auth.permissions, ["admin.staff.write"]));
const canAssign = computed(() => hasAnyPermission(auth.permissions, ["admin.staff.assign_role"]));
const canResetPw = computed(() => hasAnyPermission(auth.permissions, ["admin.staff.reset_password"]));
const canDeleteStaff = computed(() => hasAnyPermission(auth.permissions, ["admin.staff.delete"]));

async function loadRoles() {
  const res = await fetchStaffRoleOptions();
  roles.value = res.roles ?? [];
}

async function loadStaff() {
  loading.value = true;
  try {
    const res = await fetchStaffList({ page: pagination.page, limit: pagination.limit, q: q.value.trim() });
    rows.value = res.users;
    Object.assign(pagination, res.pagination);
  } finally {
    loading.value = false;
  }
}

async function submitCreate() {
  if (!createDlg.roleId) return;
  await createStaff({
    username: createDlg.username,
    password: createDlg.password,
    roleId: createDlg.roleId,
  });
  createDlg.open = false;
  await loadStaff();
  ElMessage.success("已创建");
}

function openPatch(row: StaffRow) {
  patchDlg.row = row;
  patchDlg.username = row.username;
  patchDlg.password = "";
  patchDlg.roleId = row.role?.id;
  patchDlg.open = true;
}

async function submitPatch() {
  if (!patchDlg.row) return;
  const body: Parameters<typeof patchStaff>[1] = {};
  if (canWrite.value) Object.assign(body, { username: patchDlg.username });
  if (patchDlg.password && canResetPw.value) body.password = patchDlg.password;
  if (canAssign.value && patchDlg.roleId) body.roleId = patchDlg.roleId;
  if (Object.keys(body).length === 0) {
    ElMessage.warning("没有可提交的变更");
    return;
  }
  await patchStaff(patchDlg.row.id, body);
  patchDlg.open = false;
  await loadStaff();
  ElMessage.success("已保存");
}

async function revoke(row: StaffRow) {
  await ElMessageBox.confirm("撤销该账号的后台身份（降为普通注册用户）？", "确认");
  await revokeStaff(row.id);
  await loadStaff();
}

function showRevoke(row: StaffRow) {
  return canDeleteStaff.value && row.id !== auth.userId;
}

onMounted(async () => {
  await loadRoles().catch(() => undefined);
  await loadStaff();
});
</script>

<template>
  <div>
    <el-space wrap style="margin-bottom: 12px">
      <el-button v-if="canInvite" type="primary" @click="((createDlg.open = true), (createDlg.roleId = undefined))">
        新建后台账号
      </el-button>
      <el-input v-model="q" clearable placeholder="搜索用户名" style="width: 220px" @keyup.enter="loadStaff" />
      <el-button @click="loadStaff">查询</el-button>
    </el-space>
    <el-table v-loading="loading" :data="rows" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="username" label="用户名" />
      <el-table-column label="角色">
        <template #default="{ row }">{{ row.role?.name ?? "-" }}</template>
      </el-table-column>
      <el-table-column label="操作" width="300">
        <template #default="{ row }">
          <el-space>
            <el-button v-if="canWrite || canAssign || canResetPw" link type="primary" @click="openPatch(row as StaffRow)">
              修改
            </el-button>
            <el-button
              v-if="showRevoke(row as StaffRow)"
              link
              type="danger"
              @click="revoke(row as StaffRow)"
            >
              撤销后台
            </el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="pagination.page"
      style="margin-top: 12px"
      :page-size="pagination.limit"
      :total="pagination.total"
      layout="total, prev, pager, next"
      @current-change="loadStaff"
    />

    <el-dialog v-model="createDlg.open" title="新建后台账号">
      <el-form label-width="92px">
        <el-form-item label="用户名"><el-input v-model="createDlg.username" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="createDlg.password" type="password" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createDlg.roleId" placeholder="请选择" filterable style="width: 100%">
            <el-option v-for="r in roles" :key="r.id" :label="`${r.name} (${r.slug})`" :value="r.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDlg.open = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="patchDlg.open" title="修改职员">
      <el-form label-width="92px">
        <el-form-item v-if="canWrite" label="用户名">
          <el-input v-model="patchDlg.username" />
        </el-form-item>
        <el-form-item v-if="canResetPw" label="新密码">
          <el-input v-model="patchDlg.password" type="password" placeholder="留空不改" />
        </el-form-item>
        <el-form-item v-if="canAssign" label="角色">
          <el-select v-model="patchDlg.roleId" filterable style="width: 100%">
            <el-option v-for="r in roles" :key="r.id" :label="`${r.name} (${r.slug})`" :value="r.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="patchDlg.open = false">取消</el-button>
        <el-button type="primary" @click="submitPatch">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
