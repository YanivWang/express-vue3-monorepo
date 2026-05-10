/**
 * 可选：Pexels 搜图 → 下载 → POST /api/uploads（须管理员 Bearer）。
 * API：https://www.pexels.com/api/
 */

import { SYNTHETIC_IT_HTTP_UA } from "./synthetic-it-constants.js";

type PexelsSearchResponse = {
  photos?: { src?: { medium?: string; large?: string; original?: string } }[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

/**
 * 返回本站 /uploads/... 路径；失败返回 null（调用方可降级占位图）。
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
}): Promise<string | null> {
  const q0 = opts.query.trim().slice(0, 200);
  if (!q0) return null;

  const searchOnce = async (q: string): Promise<string | null> => {
    const trimmed = q.trim().slice(0, 200);
    if (!trimmed) return null;

    const innerAttempts = 3;
    for (let attempt = 0; attempt < innerAttempts; attempt++) {
      try {
        const u = new URL("https://api.pexels.com/v1/search");
        u.searchParams.set("query", trimmed);
        u.searchParams.set("per_page", "1");

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
        const photoUrl =
          j.photos?.[0]?.src?.large ?? j.photos?.[0]?.src?.original ?? j.photos?.[0]?.src?.medium;
        if (!photoUrl) {
          return null;
        }

        const imgRes = await fetch(photoUrl, { headers: { "User-Agent": SYNTHETIC_IT_HTTP_UA } });
        if (!imgRes.ok) {
          console.warn(`[pexels] download failed HTTP ${imgRes.status}`);
          if (attempt < innerAttempts - 1) await sleep(400 * (attempt + 1));
          continue;
        }
        const buf = new Uint8Array(await imgRes.arrayBuffer());
        const ct = imgRes.headers.get("content-type") ?? "image/jpeg";
        const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";

        return await uploadMultipartImageWithRetries(
          opts.apiBase,
          opts.restToken,
          buf,
          `synthetic-cover.${ext}`,
          ct,
        );
      } catch (e) {
        console.warn(`[pexels] search/upload attempt ${attempt + 1}:`, e);
        if (attempt < innerAttempts - 1) await sleep(400 * (attempt + 1));
      }
    }
    return null;
  };

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

  for (const q of orderedQueries) {
    const path = await searchOnce(q);
    if (path) return path;
  }

  return null;
}
