import { computed, ref, watch } from "vue";

import { PAGE_SIZE, demoSecondaryCategories } from "../demo-data";

import type { PrimaryKey } from "../types";

export function useCategoryFeedDemo() {
  const activePrimary = ref<PrimaryKey>("tech");
  const activeSecondarySlug = ref("backend");
  const page = ref(1);

  const primaryLabels: Record<PrimaryKey, string> = {
    home: "首页",
    discover: "发现",
    library: "书库",
    tech: "技术",
  };

  const currentSecondaries = computed(() => {
    if (activePrimary.value === "tech") return demoSecondaryCategories;
    return [];
  });

  const currentPostsAll = computed(() => {
    if (activePrimary.value !== "tech") return [];
    const sec = demoSecondaryCategories.find((s) => s.slug === activeSecondarySlug.value);
    return sec?.posts ?? [];
  });

  const totalPosts = computed(() => currentPostsAll.value.length);

  const totalPages = computed(() => Math.max(1, Math.ceil(totalPosts.value / PAGE_SIZE)));

  const pagedPosts = computed(() => {
    const start = (page.value - 1) * PAGE_SIZE;
    return currentPostsAll.value.slice(start, start + PAGE_SIZE);
  });

  watch(activeSecondarySlug, () => {
    page.value = 1;
  });

  watch(totalPages, (tp) => {
    if (page.value > tp) page.value = tp;
  });

  function selectPrimary(key: PrimaryKey) {
    activePrimary.value = key;
    page.value = 1;
    if (key === "tech") {
      if (!demoSecondaryCategories.some((s) => s.slug === activeSecondarySlug.value)) {
        activeSecondarySlug.value = "backend";
      }
    }
  }

  function selectSecondary(slug: string) {
    activeSecondarySlug.value = slug;
  }

  function goPage(p: number) {
    const next = Math.min(Math.max(1, p), totalPages.value);
    page.value = next;
  }

  return {
    activePrimary,
    activeSecondarySlug,
    page,
    primaryLabels,
    currentSecondaries,
    pagedPosts,
    totalPages,
    selectPrimary,
    selectSecondary,
    goPage,
  };
}
