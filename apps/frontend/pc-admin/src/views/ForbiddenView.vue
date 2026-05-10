<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();
</script>

<template>
  <div style="padding: 24px">
    <el-result
      icon="warning"
      title="无权访问后台"
      sub-title="您未被授予任何后台权限（默认拒绝）。请联系超级管理员绑定角色。"
    >
      <template #extra>
        <el-button type="primary" @click="router.replace('/login')">返回登录</el-button>
      </template>
    </el-result>
  </div>
</template>
