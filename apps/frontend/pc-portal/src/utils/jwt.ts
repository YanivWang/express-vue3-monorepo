/** 仅解码 payload 用于前端展示，不做签名校验。 */
export function parseJwtPayload(token: string): { id: number; username: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2 || !parts[1]) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const p = JSON.parse(json) as { id?: unknown; username?: unknown };
    const id = Number(p.id);
    const username = String(p.username ?? "");
    if (!Number.isFinite(id) || !username) return null;
    return { id, username };
  } catch {
    return null;
  }
}
