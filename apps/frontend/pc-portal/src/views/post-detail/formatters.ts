import type { PostItem } from "@/api/types";

/** 详情页的纯展示格式化：不依赖组件状态，拆分后由多个子组件共用 */

/** 正文页脚的完整时间：2026.01.02 03:04:05 */
export function formatDetailTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}.${m}.${day} ${h}:${min}:${s}`;
}

/** 评论区的短时间：01.02 03:04 */
export function formatCommentTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}.${day} ${h}:${min}`;
}

/** 无头像时的占位首字，作者缺失时回落到「作」 */
export function authorInitial(post: PostItem | null): string {
  const name = post?.author?.username;
  if (name == null || name === "") return "作";
  return name.slice(0, 1);
}

/** 正文字数：去标签去空白后的字符数 */
export function countPostWords(post: PostItem | null): number {
  const raw = post?.content ?? "";
  return raw.replace(/<[^>]+>/g, "").replace(/\s+/g, "").length;
}
