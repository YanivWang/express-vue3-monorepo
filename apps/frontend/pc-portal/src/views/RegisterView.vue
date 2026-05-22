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
    const username = form.username.trim();
    await auth.register({ username, password: form.password });
    await auth.login({ username, password: form.password });
    ElMessage.success("注册成功");
    const r = route.query.redirect;
    await router.push(typeof r === "string" ? r : "/");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthFormLayout
    title="创建账号"
    subtitle="注册后即可参与社区互动与内容创作"
    submit-label="注册"
    switch-hint="已有账号？"
    switch-label="去登录"
    :switch-to="{ path: '/login', query: route.query }"
    :loading="loading"
    @submit="submit"
  >
    <el-form-item label="用户名">
      <el-input
        v-model="form.username"
        placeholder="设置你的用户名"
        autocomplete="username"
        size="large"
      />
    </el-form-item>
    <el-form-item label="密码">
      <el-input
        v-model="form.password"
        type="password"
        placeholder="设置登录密码"
        autocomplete="new-password"
        show-password
        size="large"
      />
    </el-form-item>
  </AuthFormLayout>
</template>
