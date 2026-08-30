<script setup lang="ts">
import { computed } from "vue";

import AppShellWriteButton from "./AppShellWriteButton.vue";

const props = defineProps<{
  isLoggedIn: boolean;
  displayName: string;
  avatar: string | null;
}>();

defineEmits<{
  write: [];
  mine: [];
  favorites: [];
  profile: [];
  logout: [];
  login: [];
  register: [];
}>();

/** 无头像时的占位首字，用户名为空时回落到「用」 */
const avatarInitial = computed(() => {
  const n = props.displayName.trim();
  return n ? n.slice(0, 1).toUpperCase() : "用";
});
</script>

<template>
  <nav class="actions" aria-label="站点与账户">
    <template v-if="isLoggedIn">
      <AppShellWriteButton @click="$emit('write')" />
      <button type="button" class="action-link" @click="$emit('mine')">我的文章</button>
      <button type="button" class="action-link" @click="$emit('favorites')">我的收藏</button>
      <span class="actions__divider" aria-hidden="true" />
      <div class="actions__user">
        <button
          type="button"
          class="actions__avatar"
          aria-label="个人资料"
          @click="$emit('profile')"
        >
          <img v-if="avatar" :src="avatar" alt="" class="actions__avatar-img" />
          <span v-else class="actions__avatar-placeholder">{{ avatarInitial }}</span>
        </button>
        <span class="hello" :title="displayName || undefined">
          你好，<span class="hello__name">{{ displayName || "用户" }}</span>
        </span>
        <button type="button" class="action-link" @click="$emit('profile')">个人资料</button>
        <button type="button" class="action-link action-link--subtle" @click="$emit('logout')">
          退出
        </button>
      </div>
    </template>
    <template v-else>
      <button type="button" class="action-link action-link--login" @click="$emit('login')">
        登录
      </button>
      <button type="button" class="btn-register" @click="$emit('register')">注册</button>
      <AppShellWriteButton @click="$emit('write')" />
    </template>
  </nav>
</template>

<style scoped lang="scss">
@use "./styles/tokens" as *;

.actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: center;
  white-space: nowrap;
}

.actions__divider {
  flex-shrink: 0;
  width: 1px;
  height: 14px;
  margin: 0 2px;
  background: #e5e5e5;
}

.actions__user {
  display: flex;
  flex-shrink: 0;
  gap: 10px;
  align-items: center;
  max-width: min(280px, 36vw);
}

.actions__avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  background: #f0f0f0;
  border: 1px solid #e8e8e8;
  border-radius: 50%;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;

  @include focus-ring(45%, 1px);

  &:hover {
    border-color: $brand;
    box-shadow: 0 0 0 1px rgb(234 111 90 / 25%);
  }
}

.actions__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.actions__avatar-placeholder {
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  color: $text-muted;
}

.action-link {
  padding: 6px 10px;
  padding-right: 0;
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.25;
  color: $text-sub;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  transition:
    color 0.18s ease,
    background-color 0.18s ease;

  @include focus-ring(45%, 1px);

  &:hover {
    color: $brand;
    background-color: rgb(0 0 0 / 3%);
  }
}

.action-link--subtle {
  color: $text-muted;

  &:hover {
    color: $brand;
  }
}

.action-link--login {
  padding-right: 6px;
}

.btn-register {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  padding: 6px 18px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  color: $brand;
  white-space: nowrap;
  cursor: pointer;
  background: #fff;
  border: 1px solid $brand;
  border-radius: 999px;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;

  @include focus-ring;

  &:hover {
    background: rgb(234 111 90 / 8%);
  }
}

.hello {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 1.3;
  color: $text-muted;
  white-space: nowrap;
}

.hello__name {
  font-weight: 500;
  color: $text;
}
</style>
