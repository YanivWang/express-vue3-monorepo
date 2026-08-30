<script setup lang="ts">
/**
 * 顶栏右侧入口。
 *
 * 这是分类内容流的演示页，登录/注册/写文章尚未接真实路由，
 * 保持与设计稿一致的静态入口即可（见 CategoryFeedDemoView 的定位）。
 */
</script>

<template>
  <div class="cf__header-right">
    <button type="button" class="cf__icon-btn" aria-label="阅读偏好">
      <span class="cf__aa" aria-hidden="true">Aa</span>
    </button>
    <a class="cf__link-login" href="javascript:void(0)">登录</a>
    <a class="cf__btn-reg" href="javascript:void(0)">注册</a>
    <a class="cf__btn-write" href="javascript:void(0)">
      <span class="cf__pen" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="currentColor"
            d="M4 20.5L4.5 17l10-10 3 3-10 10L4 20.5zm12.2-11.7l-1-1 1.8-1.8a1 1 0 0 1 1.4 0l.6.6a1 1 0 0 1 0 1.4l-1.8 1.8-1-1z"
          />
        </svg>
      </span>
      <span>写文章</span>
    </a>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.cf__header-right {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
  align-items: center;
}

.cf__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  margin-right: 4px;
  cursor: default;
  background: transparent;
  border: none;
  border-radius: 20px;
  transition: background-color 0.2s ease;

  &:hover {
    background: rgb(0 0 0 / 4%);
  }
}

.cf__aa {
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  color: #969696;
}

.cf__link-login {
  padding: 0 8px;
  margin-right: 2px;
  font-size: 15px;
  color: $cf-text;
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: $cf-primary;
  }
}

.cf__btn-reg {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  padding: 6px 20px;
  margin: 0 4px 0 2px;
  font-size: 15px;
  font-weight: 400;
  line-height: 1;
  color: $cf-primary;
  white-space: nowrap;
  text-decoration: none;
  background: #fff;
  border: 1px solid $cf-reg-border;
  border-radius: 20px;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;

  &:hover {
    background: rgb(234 111 90 / 6%);
  }
}

.cf__btn-write {
  box-sizing: border-box;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 8px 25px;
  margin-left: 2px;
  font-size: 15px;
  font-weight: 400;
  line-height: 1;
  color: #fff;
  white-space: nowrap;
  text-decoration: none;
  background: $cf-primary;
  border-radius: 20px;
  box-shadow: 0 1px 0 rgb(0 0 0 / 4%);

  &:hover {
    background: #ec6149;
  }
}

.cf__pen {
  display: inline-flex;
  line-height: 0;
  opacity: 0.95;
}
</style>
