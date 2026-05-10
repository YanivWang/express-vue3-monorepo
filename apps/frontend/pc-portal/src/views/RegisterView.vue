<script setup lang="ts">
import { ElMessage } from "element-plus";
import { reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();
const loading = ref(false);
const form = reactive({ username: "", password: "" });

async function submit() {
  loading.value = true;
  try {
    await auth.register({ username: form.username.trim(), password: form.password });
    ElMessage.success("注册成功，请登录");
    await router.push({ name: "login" });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="panel">
    <h1>注册</h1>
    <el-form label-position="top" class="form" @submit.prevent="submit">
      <el-form-item label="用户名">
        <el-input v-model="form.username" autocomplete="username" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" autocomplete="new-password" />
      </el-form-item>
      <el-button type="primary" native-type="submit" :loading="loading" class="btn">注册</el-button>
      <RouterLink class="link" to="/login">已有账号？登录</RouterLink>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
.panel {
  max-width: 400px;
  padding: 28px 28px 36px;
  margin: 40px auto;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
}

h1 {
  margin: 0 0 20px;
  font-size: 22px;
}

.btn {
  width: 100%;
  margin-top: 8px;
}

.link {
  display: block;
  margin-top: 16px;
  font-size: 14px;
  color: var(--el-color-primary);
  text-align: center;
}
</style>
