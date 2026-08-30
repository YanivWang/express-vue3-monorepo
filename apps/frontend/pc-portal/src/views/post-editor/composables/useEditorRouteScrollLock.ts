import { onBeforeUnmount, onMounted } from "vue";

const EDITOR_ROUTE_LOCK_CLASS = "editor-route-lock";

/**
 * 写作页占满视口且内部自行滚动，进入时给 <html> 挂锁定类，
 * 离开时务必摘掉——否则整站都会失去滚动。
 */
export function useEditorRouteScrollLock() {
  onMounted(() => {
    document.documentElement.classList.add(EDITOR_ROUTE_LOCK_CLASS);
  });

  onBeforeUnmount(() => {
    document.documentElement.classList.remove(EDITOR_ROUTE_LOCK_CLASS);
  });
}
