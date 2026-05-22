const DRAFT_PREFIX = "pc_portal_post_editor_draft:";

export interface PostEditorDraft {
  title: string;
  categoryId: number | null;
  published: boolean;
  coverUrl: string | null;
  contentHtml: string;
  savedAt: number;
}

export function draftStorageKey(postId: number | null): string {
  return `${DRAFT_PREFIX}${postId ?? "new"}`;
}

export function readPostEditorDraft(postId: number | null): PostEditorDraft | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(postId));
    if (raw == null || raw === "") return null;
    const parsed = JSON.parse(raw) as PostEditorDraft;
    if (typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePostEditorDraft(postId: number | null, draft: PostEditorDraft): void {
  localStorage.setItem(draftStorageKey(postId), JSON.stringify(draft));
}

export function clearPostEditorDraft(postId: number | null): void {
  localStorage.removeItem(draftStorageKey(postId));
}

export function formatDraftSavedAt(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
