<script setup lang="ts">
import { RouterLink } from "vue-router";

import type { PrimaryKey } from "../types";

defineProps<{
  activePrimary: PrimaryKey;
  primaryLabels: Record<PrimaryKey, string>;
}>();

const emit = defineEmits<{
  selectPrimary: [key: PrimaryKey];
}>();
</script>

<template>
  <header class="cf__header">
    <div class="cf__header-inner">
      <div class="cf__header-left">
        <RouterLink class="cf__logo" :to="{ path: '/' }">简书</RouterLink>
        <nav class="cf__nav" aria-label="主导航">
          <a
            href="javascript:void(0)"
            class="cf__nav-item"
            :class="{ 'cf__nav-item--active': activePrimary === 'home' }"
            @click.prevent="emit('selectPrimary', 'home')"
          >
            <span class="cf__nav-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="1em" height="1em">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                />
                <path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  d="M12 7v5l3 3"
                />
              </svg>
            </span>
            <span>{{ primaryLabels.home }}</span>
          </a>
          <a
            href="javascript:void(0)"
            class="cf__nav-item"
            :class="{ 'cf__nav-item--active': activePrimary === 'discover' }"
            @click.prevent="emit('selectPrimary', 'discover')"
          >
            <span class="cf__nav-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="1em" height="1em">
                <rect
                  x="7"
                  y="3"
                  width="10"
                  height="18"
                  rx="2.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                />
                <path fill="currentColor" d="M10 6h4v1.5h-4z" />
              </svg>
            </span>
            <span>{{ primaryLabels.discover }}</span>
          </a>
          <a
            href="javascript:void(0)"
            class="cf__nav-item"
            :class="{ 'cf__nav-item--active': activePrimary === 'library' }"
            @click.prevent="emit('selectPrimary', 'library')"
          >
            <span class="cf__nav-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="1em" height="1em">
                <path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linejoin="round"
                  d="M5 9l2-4h10l2 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9z"
                />
                <path fill="currentColor" d="M9 20v-5h6v5" />
              </svg>
            </span>
            <span>{{ primaryLabels.library }}</span>
          </a>
          <a
            href="javascript:void(0)"
            class="cf__nav-item"
            :class="{ 'cf__nav-item--active': activePrimary === 'tech' }"
            @click.prevent="emit('selectPrimary', 'tech')"
          >
            <span class="cf__nav-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="1em" height="1em">
                <path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  d="M8 8l-3 3 3 3M16 8l3 3-3 3M10.5 15.5l3-7"
                />
              </svg>
            </span>
            <span>{{ primaryLabels.tech }}</span>
          </a>
        </nav>
      </div>

      <div class="cf__header-flex" aria-hidden="true" />

      <div class="cf__search-wrap">
        <label class="cf__search">
          <input class="cf__search-input" type="search" placeholder="搜索" autocomplete="off" />
          <span class="cf__search-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="#969696" stroke-width="2" />
              <path stroke="#969696" stroke-width="2" stroke-linecap="round" d="M16 16l4 4" />
            </svg>
          </span>
        </label>
      </div>

      <div class="cf__header-flex" aria-hidden="true" />

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
    </div>
  </header>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.cf__header {
  position: sticky;
  top: 0;
  z-index: 1000;
  height: $cf-header-h;
  background: #ffffff;
  border-bottom: 1px solid $cf-border;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.02);
}

.cf__header-inner {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  max-width: $cf-container;
  height: 100%;
  padding: 0 15px;
  margin: 0 auto;
}

.cf__header-left {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
}

.cf__header-flex {
  flex: 1 1 0;
  min-width: 16px;
}

.cf__logo {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  margin-right: 14px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  color: $cf-primary;
  letter-spacing: 0.02em;
  white-space: nowrap;
  text-decoration: none;
}

.cf__nav {
  display: flex;
  align-items: center;
}

.cf__nav-item {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  height: $cf-header-h;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 400;
  line-height: 26px;
  color: $cf-text;
  white-space: nowrap;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition:
    color 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    color: $cf-text;
    background-color: rgb(0 0 0 / 0.02);
  }
}

.cf__nav-ico {
  display: inline-flex;
  margin-right: 6px;
  font-size: 18px;
  color: currentColor;
  opacity: 0.95;

  svg {
    display: block;
  }
}

.cf__nav-item--active {
  color: $cf-primary;
  border-bottom-color: $cf-primary;

  &:hover {
    color: $cf-primary;
  }
}

.cf__search-wrap {
  display: flex;
  flex: 0 0 auto;
  justify-content: center;
}

.cf__search {
  position: relative;
  display: block;
}

.cf__search-input {
  box-sizing: border-box;
  display: block;
  width: 200px;
  height: 38px;
  padding: 0 38px 0 16px;
  margin: 0;
  font: inherit;
  font-size: 14px;
  color: $cf-text;
  outline: none;
  background: $cf-search-bg;
  border: none;
  border-radius: 20px;
  transition: width 0.5s ease;

  &::placeholder {
    color: #a0a0a0;
  }

  &:focus {
    width: 260px;
    background: #eeeeee;
  }
}

.cf__search-ico {
  position: absolute;
  top: 50%;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  pointer-events: none;
  transform: translateY(-50%);
}

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
    background: rgb(0 0 0 / 0.04);
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
  background: #ffffff;
  border: 1px solid $cf-reg-border;
  border-radius: 20px;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;

  &:hover {
    background: rgb(234 111 90 / 0.06);
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
  color: #ffffff;
  white-space: nowrap;
  text-decoration: none;
  background: $cf-primary;
  border-radius: 20px;
  box-shadow: 0 1px 0 rgb(0 0 0 / 0.04);

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
