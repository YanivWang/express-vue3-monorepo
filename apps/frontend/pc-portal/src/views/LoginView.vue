<script setup lang="ts">
import { ElMessage } from "element-plus";
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import AuthFormLayout from "@/components/AuthFormLayout.vue";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const loading = ref(false);
const form = reactive({ username: "", password: "" });

async function submit() {
  loading.value = true;
  try {
    await auth.login({ username: form.username.trim(), password: form.password });
    ElMessage.success("登录成功");
    const r = route.query.redirect;
    await router.push(typeof r === "string" ? r : "/");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthFormLayout
    title="欢迎回来"
    subtitle="登录后即可收藏、评论与发布文章"
    submit-label="登录"
    switch-hint="没有账号？"
    switch-label="立即注册"
    :switch-to="{ path: '/register', query: route.query }"
    :loading="loading"
    @submit="submit"
  >
    <el-form-item label="用户名">
      <el-input
        v-model="form.username"
        placeholder="请输入用户名"
        autocomplete="username"
        size="large"
      />
    </el-form-item>
    <el-form-item label="密码">
      <el-input
        v-model="form.password"
        type="password"
        placeholder="请输入密码"
        autocomplete="current-password"
        show-password
        size="large"
      />
    </el-form-item>
  </AuthFormLayout>
</template>
