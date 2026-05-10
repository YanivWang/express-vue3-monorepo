/**
 * 可选：Pexels 搜图 → 下载 → POST /api/uploads（须管理员 Bearer）。
 * API：https://www.pexels.com/api/
 */

import { SYNTHETIC_IT_HTTP_UA } from "./synthetic-it-constants.js";

type PexelsPhotoRow = {
  id?: number;
  src?: { medium?: string; large?: string; original?: string };
};

type PexelsSearchResponse = {
  photos?: PexelsPhotoRow[];
};

const PEXELS_PER_PAGE = 24;
const PEXELS_MAX_PAGES_PER_QUERY = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 确定性选择下标（非加密）；用于在多张候选里摊开配图，不必每帖都命中「第一条」。 */
export function syntheticImagePickIndex(len: number, salt: string, pageHint: number): number {
  if (len <= 0) return 0;
  let h = 2166136261;
  const merged = `${salt}|p=${pageHint}`;
  for (let i = 0; i < merged.length; i++) {
    h ^= merged.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = h >>> 0;
  return u % len;
}

async function uploadMultipartImage(
  apiBase: string,
  bearerToken: string,
  bytes: Uint8Array,
  filename: string,
  contentType: string,
): Promise<string> {
  const url = `${apiBase.replace(/\/$/, "")}/uploads`;
  const form = new FormData();
  form.append("files", new Blob([bytes], { type: contentType }), filename);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "User-Agent": SYNTHETIC_IT_HTTP_UA,
    },
    body: form,
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || j.code !== 200) {
    throw new Error(`POST ${url} failed: HTTP ${res.status} ${JSON.stringify(j)}`);
  }
  const urls = j.urls as string[] | undefined;
  const first = urls?.[0]?.trim();
  if (!first) {
    throw new Error(`上传响应缺少 urls: ${JSON.stringify(j)}`);
  }
  return first;
}

async function uploadMultipartImageWithRetries(
  apiBase: string,
  bearerToken: string,
  bytes: Uint8Array,
  filename: string,
  contentType: string,
  maxAttempts = 3,
): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await uploadMultipartImage(apiBase, bearerToken, bytes, filename, contentType);
    } catch (e) {
      lastErr = e;
      if (i < maxAttempts - 1) {
        await sleep(350 * (i + 1));
      }
    }
  }
  throw lastErr;
}

function photoDownloadUrl(row: PexelsPhotoRow): string | undefined {
  return row.src?.large ?? row.src?.original ?? row.src?.medium;
}

export type PexelsUploadedImage = {
  uploadUrl: string;
  /** Pexels `photos[].id`，用于整场种子内去重 */
  pexelsPhotoId: number;
};

/**
 * 返回本站 `/uploads/...` 路径与 Pexels 图 id；失败返回 null（调用方可降级占位图）。
 *
 * - 单次检索拉 `per_page` 多张并翻页，优先选 **`avoidPexelsPhotoIds` 中尚未出现过的** id；
 * - `selectionSalt` 建议含分类 + 帖子键，使相似检索词仍会落到不同下标；
 * - 只有当该查询名下所有页的候选均已占用时，才接受重复使用已出现过的 id（极端情况）。
 */
export async function fetchPexelsPhotoAndUpload(opts: {
  apiBase: string;
  restToken: string;
  pexelsApiKey: string;
  query: string;
  /** 第二次检索追加词（与 query 拼接成第二条检索） */
  refineHint?: string;
  /** 在主查询与 refine 均无果时依次尝试的检索词 */
  fallbackQueries?: string[];
  /** 已在本场种子中用过的 Pexels photo id，优先避开 */
  avoidPexelsPhotoIds?: ReadonlySet<number>;
  /** 稳定盐（例如 `category|externalKey`），与同 query 的其他帖错开条目 */
  selectionSalt?: string;
}): Promise<PexelsUploadedImage | null> {
  const q0 = opts.query.trim().slice(0, 200);
  if (!q0) return null;

  const avoid = opts.avoidPexelsPhotoIds ?? new Set<number>();
  const salt = (opts.selectionSalt ?? q0).slice(0, 300);

  const orderedQueries: string[] = [];
  const pushUnique = (s: string) => {
    const t = s.trim().slice(0, 200);
    if (!t || orderedQueries.includes(t)) return;
    orderedQueries.push(t);
  };

  pushUnique(q0);
  if (opts.refineHint) {
    pushUnique(`${q0} ${opts.refineHint}`.trim());
  }
  for (const fq of opts.fallbackQueries ?? []) {
    pushUnique(fq);
  }

  const fetchPageRows = async (
    trimmed: string,
    pageNum: number,
  ): Promise<Array<PexelsPhotoRow & { id: number }> | null> => {
    const innerAttempts = 3;
    for (let attempt = 0; attempt < innerAttempts; attempt++) {
      try {
        const u = new URL("https://api.pexels.com/v1/search");
        u.searchParams.set("query", trimmed);
        u.searchParams.set("per_page", String(PEXELS_PER_PAGE));
        u.searchParams.set("page", String(pageNum));

        const res = await fetch(u.toString(), {
          headers: {
            Authorization: opts.pexelsApiKey,
            "User-Agent": SYNTHETIC_IT_HTTP_UA,
          },
        });
        const j = (await res.json().catch(() => ({}))) as PexelsSearchResponse &
          Record<string, unknown>;
        if (!res.ok) {
          console.warn(`[pexels] HTTP ${res.status}: ${JSON.stringify(j)}`);
          if (attempt < innerAttempts - 1) await sleep(400 * (attempt + 1));
          continue;
        }
        const rows = (j.photos ?? []).filter(
          (p): p is PexelsPhotoRow & { id: number } => typeof p.id === "number",
        );
        return rows;
      } catch (e) {
        console.warn(`[pexels] search attempt ${attempt + 1}:`, e);
        if (attempt < innerAttempts - 1) await sleep(400 * (attempt + 1));
      }
    }
    return null;
  };

  const tryUploadFromRows = async (
    rows: (PexelsPhotoRow & { id: number })[],
    preferNewId: boolean,
    pageNum: number,
  ): Promise<PexelsUploadedImage | null> => {
    const pool = preferNewId && avoid.size > 0 ? rows.filter((p) => !avoid.has(p.id)) : rows;
    if (pool.length === 0) return null;

    const ix = syntheticImagePickIndex(pool.length, salt, pageNum);
    const picked = pool[ix];
    const photoUrl = photoDownloadUrl(picked);
    if (!photoUrl) return null;

    const innerAttempts = 3;
    for (let attempt = 0; attempt < innerAttempts; attempt++) {
      try {
        const imgRes = await fetch(photoUrl, { headers: { "User-Agent": SYNTHETIC_IT_HTTP_UA } });
        if (!imgRes.ok) {
          console.warn(`[pexels] download failed HTTP ${imgRes.status}`);
          if (attempt < innerAttempts - 1) await sleep(400 * (attempt + 1));
          continue;
        }
        const buf = new Uint8Array(await imgRes.arrayBuffer());
        const ct = imgRes.headers.get("content-type") ?? "image/jpeg";
        const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";

        const uploadUrl = await uploadMultipartImageWithRetries(
          opts.apiBase,
          opts.restToken,
          buf,
          `pexels-${picked.id}.${ext}`,
          ct,
        );
        return { uploadUrl, pexelsPhotoId: picked.id };
      } catch (e) {
        console.warn(`[pexels] upload attempt ${attempt + 1}:`, e);
        if (attempt < innerAttempts - 1) await sleep(400 * (attempt + 1));
      }
    }
    return null;
  };

  const searchAndPickForQuery = async (trimmed: string): Promise<PexelsUploadedImage | null> => {
    /** 先试：整场尚未用过的 Pexels id */
    for (let pageNum = 1; pageNum <= PEXELS_MAX_PAGES_PER_QUERY; pageNum++) {
      const rows = await fetchPageRows(trimmed, pageNum);
      if (!rows?.length) break;
      const uploaded = await tryUploadFromRows(rows, true, pageNum);
      if (uploaded) return uploaded;
    }

    if (avoid.size === 0) return null;

    /** 本条检索下已无可新路 id（或 API 分页返回重叠），最后再允许重复使用已用过的 id（仍用盐错开条目） */
    for (let pageNum = 1; pageNum <= PEXELS_MAX_PAGES_PER_QUERY; pageNum++) {
      const rows = await fetchPageRows(trimmed, pageNum);
      if (!rows?.length) break;
      const uploaded = await tryUploadFromRows(rows, false, pageNum + 101);
      if (uploaded) return uploaded;
    }

    return null;
  };

  for (const q of orderedQueries) {
    const path = await searchAndPickForQuery(q);
    if (path) return path;
  }

  return null;
}
