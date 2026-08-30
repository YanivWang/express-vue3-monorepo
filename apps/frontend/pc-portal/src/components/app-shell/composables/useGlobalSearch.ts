import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

/** 顶栏全站搜索：输入框与 URL 上的 q 保持同步 */
export function useGlobalSearch() {
  const route = useRoute();
  const router = useRouter();

  const draft = ref("");

  watch(
    () => [route.name, route.query.q] as const,
    () => {
      // 离开搜索页就清空，避免在别的页面残留上一次的关键词
      if (route.name !== "search") {
        draft.value = "";
        return;
      }
      const raw = route.query.q;
      draft.value =
        typeof raw === "string"
          ? raw
          : Array.isArray(raw) && raw.length > 0 && raw[0] != null
            ? String(raw[0])
            : "";
    },
    { immediate: true },
  );

  function submit() {
    const t = draft.value.trim();
    void router.push({ path: "/search", query: t ? { q: t } : {} });
  }

  return { draft, submit };
}
