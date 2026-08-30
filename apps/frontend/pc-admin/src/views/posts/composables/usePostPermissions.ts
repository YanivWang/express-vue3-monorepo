import { computed } from "vue";

import type { PostItem } from "@/api/types";
import { useAuthStore } from "@/stores/auth";
import { hasAnyPermission } from "@/utils/permissions";

/**
 * 逐行的操作权限。
 *
 * 规则统一为「有全局权限码，或者这行是自己写的」——
 * 没有写权限的编辑仍然能维护自己的文章。
 */
export function usePostPermissions() {
  const auth = useAuthStore();

  const permissions = computed(() => auth.permissions);
  const canWrite = computed(() => hasAnyPermission(permissions.value, ["admin.posts.write"]));
  const canDeleteAny = computed(() => hasAnyPermission(permissions.value, ["admin.posts.delete"]));
  const canReadComments = computed(() =>
    hasAnyPermission(permissions.value, ["admin.comments.read"]),
  );
  const canFilterByAuthor = computed(() =>
    hasAnyPermission(permissions.value, ["admin.portal_users.read"]),
  );

  function isOwnPost(row: PostItem) {
    return row.authorId === auth.userId;
  }

  function canEditRow(row: PostItem) {
    return canWrite.value || isOwnPost(row);
  }

  function canDeleteRow(row: PostItem) {
    return canDeleteAny.value || isOwnPost(row);
  }

  return {
    permissions,
    canWrite,
    canReadComments,
    canFilterByAuthor,
    canEditRow,
    canDeleteRow,
  };
}
