<script setup lang="ts">
export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  /** 必填项决定能否发布；可选项只作提示 */
  required: boolean;
}

defineProps<{
  items: ChecklistItem[];
  allRequiredDone: boolean;
}>();
</script>

<template>
  <section class="sidebar-card sidebar-card--checklist">
    <div class="sidebar-card__head">
      <h2 class="sidebar-card__title">发布前检查</h2>
      <span class="sidebar-card__badge" :class="allRequiredDone ? 'is-ready' : 'is-pending'">
        {{ allRequiredDone ? "可发布" : "待完善" }}
      </span>
    </div>
    <ul class="checklist">
      <li
        v-for="item in items"
        :key="item.key"
        class="checklist__item"
        :class="{ 'is-done': item.done, 'is-optional': !item.required }"
      >
        <span class="checklist__mark" aria-hidden="true">
          <svg v-if="item.done" viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </span>
        <span class="checklist__label">
          {{ item.label }}
          <span v-if="!item.required" class="checklist__tag">可选</span>
        </span>
        <span class="checklist__status">{{ item.done ? "已完成" : "未完成" }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.sidebar-card {
  @include sidebar-card;
}

.sidebar-card--checklist {
  background: linear-gradient(180deg, #fff 0%, $surface-soft 100%);
}

.sidebar-card__head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.sidebar-card__title {
  @include sidebar-card-title;
}

.sidebar-card__badge {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;

  &.is-ready {
    color: #0f766e;
    background: rgb(15 118 110 / 12%);
  }

  &.is-pending {
    color: #b45309;
    background: rgb(180 83 9 / 12%);
  }
}

.checklist {
  padding: 0;
  margin: 0;
  list-style: none;
}

.checklist__item {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid $stroke-subtle;

  &:last-child {
    border-bottom: 0;
  }

  &.is-done .checklist__mark {
    color: #0f766e;
    background: rgb(15 118 110 / 12%);
    border-color: transparent;
  }

  &.is-done .checklist__status {
    color: #0f766e;
  }

  &.is-optional .checklist__status {
    color: $text-muted;
  }
}

.checklist__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: transparent;
  border: 1.5px solid rgb(0 0 0 / 12%);
  border-radius: 50%;
}

.checklist__label {
  font-size: 13px;
  font-weight: 500;
  color: $text-main;
}

.checklist__tag {
  margin-left: 4px;
  font-size: 11px;
  font-weight: 500;
  color: $text-muted;
}

.checklist__status {
  font-size: 12px;
  color: #b45309;
}
</style>
