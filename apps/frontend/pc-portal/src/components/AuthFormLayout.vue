<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

defineProps<{
  title: string;
  subtitle: string;
  submitLabel: string;
  loading?: boolean;
  switchHint: string;
  switchLabel: string;
  switchTo: RouteLocationRaw;
}>();

defineEmits<{
  submit: [];
}>();
</script>

<template>
  <div class="auth-page">
    <section class="auth-card" aria-labelledby="auth-form-title">
      <header class="auth-card__head">
        <h1 id="auth-form-title" class="auth-card__title">{{ title }}</h1>
        <p class="auth-card__sub">{{ subtitle }}</p>
      </header>

      <el-form class="auth-form" label-position="top" @submit.prevent="$emit('submit')">
        <slot />

        <el-button class="auth-form__submit" native-type="submit" :loading="loading">
          {{ submitLabel }}
        </el-button>

        <p class="auth-card__foot">
          <span class="auth-card__foot-hint">{{ switchHint }}</span>
          <RouterLink class="auth-card__foot-link" :to="switchTo">{{ switchLabel }}</RouterLink>
        </p>
      </el-form>
    </section>
  </div>
</template>

<style scoped lang="scss">
$brand: #ea6f5a;
$brand-hover: #e25b46;
$text: #333;
$muted: #888;
$line: #f0f0f0;

.auth-page {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 32px 16px calc(32px + 4vh);
}

.auth-card {
  box-sizing: border-box;
  width: 500px;
  max-width: 100%;
  padding: 36px 40px 32px;
  background: #fff;
  border: 1px solid rgb(0 0 0 / 4%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 3%);
}

.auth-card__head {
  padding-bottom: 24px;
  margin-bottom: 8px;
  text-align: center;
  border-bottom: 1px solid $line;
}

.auth-card__title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.35;
  color: $text;
}

.auth-card__sub {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: $muted;
}

.auth-form {
  :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  :deep(.el-form-item__label) {
    padding-bottom: 6px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
    color: #555;
  }

  :deep(.el-input__wrapper) {
    padding: 2px 14px;
    background: #f3f3f3;
    border-radius: 8px;
    box-shadow: none;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;

    &:hover {
      background: #eee;
    }

    &.is-focus {
      background: #fff;
      box-shadow: 0 0 0 1px rgb(234 111 90 / 40%) inset;
    }
  }

  :deep(.el-input__inner) {
    height: 40px;
    font-size: 14px;
    color: $text;

    &::placeholder {
      color: #9a9a9a;
    }
  }
}

.auth-form__submit {
  width: 100%;
  height: 42px;
  margin-top: 4px;
  font-size: 15px;
  font-weight: 500;
  color: #fff;
  background: $brand;
  border: none;
  border-radius: 999px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover,
  &:focus {
    color: #fff;
    background: $brand-hover;
    box-shadow: 0 2px 8px rgb(234 111 90 / 28%);
  }

  &:active {
    color: #fff;
    background: #d95440;
  }
}

.auth-card__foot {
  margin: 20px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: $muted;
  text-align: center;
}

.auth-card__foot-hint {
  margin-right: 4px;
}

.auth-card__foot-link {
  font-weight: 500;
  color: $brand;
  text-decoration: none;
  transition: color 0.15s ease;

  &:hover {
    color: $brand-hover;
    text-decoration: underline;
  }
}

@media (width <= 480px) {
  .auth-page {
    align-items: flex-start;
    padding-top: 24px;
    padding-bottom: 32px;
  }

  .auth-card {
    padding: 28px 24px 26px;
  }

  .auth-card__title {
    font-size: 20px;
  }
}
</style>
