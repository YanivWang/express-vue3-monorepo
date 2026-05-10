import type { PostItem } from "@/api/types";

/** 列表摘要用纯文本 */
export function stripToPlain(html: string | undefined): string {
  if (html == null || html === "") return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cardAbstract(p: PostItem): string {
  return stripToPlain(p.content);
}

export function cardCoverUrl(p: PostItem): string | null {
  const first = p.images?.[0];
  if (first != null && first !== "") return first;
  const m = (p.content ?? "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

export function authorInitial(p: PostItem): string {
  const name = p.author?.username;
  if (name == null || name === "") return "作";
  return name.slice(0, 1);
}

export function formatFeedTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}
