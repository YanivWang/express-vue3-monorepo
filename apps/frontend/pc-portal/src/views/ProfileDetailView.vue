<script setup lang="ts">
import { ElMessage } from "element-plus";
import { storeToRefs } from "pinia";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import type { UserProfileDetail } from "@/api/types";
import { fetchMyProfile } from "@/api/user";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const auth = useAuthStore();
const { profile: me } = storeToRefs(auth);
const detail = ref<UserProfileDetail | null>(null);
const loading = ref(false);

function dash(s: string | null | undefined) {
  return s != null && String(s).trim() !== "" ? String(s) : "未填写";
}

function genderLabel(g: string | null) {
  if (g === "male") return "男";
  if (g === "female") return "女";
  if (g === "unknown") return "不便透露";
  return "未填写";
}

function marriedLabel(m: boolean | null) {
  if (m === true) return "已婚";
  if (m === false) return "未婚";
  return "未填写";
}

onMounted(async () => {
  loading.value = true;
  try {
    await auth.fetchProfile();
    const { profile } = await fetchMyProfile();
    detail.value = profile;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
});

const username = computed(() => me.value?.username ?? "");
</script>

<template>
  <div v-loading="loading" class="mine profile-detail">
    <div class="toolbar">
      <h1>个人资料</h1>
      <el-button type="primary" @click="router.push({ name: 'profile-edit' })">编辑资料</el-button>
    </div>
    <el-descriptions :column="1" border class="desc">
      <el-descriptions-item label="用户名">{{ dash(username) }}</el-descriptions-item>
      <el-descriptions-item label="昵称">{{ dash(detail?.nickname) }}</el-descriptions-item>
      <el-descriptions-item label="头像 URL">{{ dash(detail?.avatar) }}</el-descriptions-item>
      <el-descriptions-item label="性别">{{
        genderLabel(detail?.gender ?? null)
      }}</el-descriptions-item>
      <el-descriptions-item label="生日">{{ dash(detail?.birthday) }}</el-descriptions-item>
      <el-descriptions-item label="个人简介">{{ dash(detail?.bio) }}</el-descriptions-item>
      <el-descriptions-item label="住址">{{ dash(detail?.address) }}</el-descriptions-item>
      <el-descriptions-item label="公司">{{ dash(detail?.company) }}</el-descriptions-item>
      <el-descriptions-item label="职称">{{ dash(detail?.jobTitle) }}</el-descriptions-item>
      <el-descriptions-item label="婚姻状况">{{
        marriedLabel(detail?.isMarried ?? null)
      }}</el-descriptions-item>
      <el-descriptions-item label="母亲">{{ dash(detail?.mom) }}</el-descriptions-item>
      <el-descriptions-item label="父亲">{{ dash(detail?.father) }}</el-descriptions-item>
      <el-descriptions-item label="大学">{{ dash(detail?.university) }}</el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<style scoped lang="scss">
.profile-detail {
  padding: 20px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.toolbar h1 {
  margin: 0;
  font-size: 18px;
}

.desc {
  margin-top: 8px;
}
</style>
