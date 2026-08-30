import { ref } from "vue";

import { fetchCategories } from "@/api/categories";
import type { CategoryTreeNode } from "@/api/types";

export interface LeafCategoryOption {
  id: number;
  /** 逐级拼出的完整路径，如「技术 / 前端工程」 */
  label: string;
}

/** 只有叶子节点可挂文章，一级分类不进选项 */
function flattenLeaves(nodes: CategoryTreeNode[], prefix = ""): LeafCategoryOption[] {
  const out: LeafCategoryOption[] = [];
  for (const n of nodes) {
    const label = prefix ? `${prefix} / ${n.name}` : n.name;
    if (n.children?.length) {
      out.push(...flattenLeaves(n.children, label));
    } else if (n.parentId != null) {
      out.push({ id: n.id, label });
    }
  }
  return out;
}

/** 叶子分类选项，筛选栏与编辑对话框共用 */
export function useLeafCategories() {
  const leafOptions = ref<LeafCategoryOption[]>([]);

  async function reloadTree() {
    const { categories } = await fetchCategories();
    leafOptions.value = flattenLeaves(categories ?? []);
  }

  return { leafOptions, reloadTree };
}
