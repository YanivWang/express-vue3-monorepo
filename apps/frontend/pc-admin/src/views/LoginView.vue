<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const loading = ref(false);

const form = reactive({
  username: "",
  password: "",
});

async function submit() {
  loading.value = true;
  try {
    await auth.login({ username: form.username.trim(), password: form.password });
    const redirect = (route.query.redirect as string) || "/posts";
    await router.replace(redirect);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login">
    <el-card class="login__card">
      <h2 style="margin-top: 0">pc-admin 登录</h2>
      <el-form @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" autocomplete="current-password" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" native-type="submit" style="width: 100%">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.login {
  display: grid;
  place-items: center;
  min-height: 100vh;
  background: #f3f4f6;

  &__card {
    width: 360px;
  }
}
</style>
