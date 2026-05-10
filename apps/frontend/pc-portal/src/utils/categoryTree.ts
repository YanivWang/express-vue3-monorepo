import type { CategoryTreeNode } from "@/api/types";

/** 在分类树中按 id 查找节点（含子级）。 */
export function findCategoryNodeById(
  nodes: CategoryTreeNode[],
  id: number,
): CategoryTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findCategoryNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** 若 `leafId` 为某个根节点下的二级叶子，则返回该根节点 id，否则 null。 */
export function findParentIdOfLeaf(roots: CategoryTreeNode[], leafId: number): number | null {
  for (const root of roots) {
    if (root.children?.some((c) => c.id === leafId)) return root.id;
  }
  return null;
}
