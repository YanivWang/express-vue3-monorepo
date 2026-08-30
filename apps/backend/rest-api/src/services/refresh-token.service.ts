/**
 * 刷新令牌：不透明、服务端可撤销、每次使用即轮换，并带重放检测。
 *
 * 为什么不能只靠一枚长效 JWT：
 * JWT 一经签发就无法收回，只能等它自然过期。改造前访问令牌有效期 7 天，
 * 意味着凭证一旦泄露，攻击者就拥有一周的完整账号权限，而系统既察觉不到、也阻止不了。
 *
 * 这里的取舍：
 * - 令牌本身不透明（不是 JWT），校验必须回到服务端，因此「撤销」是真的能生效的；
 * - 明文只在签发那一刻存在，Redis 只保存 SHA-256 摘要，库被读走也无法直接冒用；
 * - 每次刷新都轮换：旧令牌立刻失效，泄露窗口从「整个有效期」缩短到「下一次刷新之前」；
 * - 重放检测：一枚已经用过的刷新令牌再次出现，只可能是它被复制走了。
 *   此时撤销整个令牌家族（强制重新登录），而不是听任攻击者与真实用户并行持有会话。
 */
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { REFRESH_TOKEN_TTL_SECONDS } from "../env.js";
import { redis } from "../redis.js";
import { logger } from "../utils/logger.js";

/** 单条刷新令牌记录 */
const TOKEN_KEY_PREFIX = "auth:refresh:token:";
/** 令牌家族：一次登录派生出的所有轮换令牌，用于整体撤销 */
const FAMILY_KEY_PREFIX = "auth:refresh:family:";
/** 已使用令牌的墓碑，用于识别重放 */
const USED_KEY_PREFIX = "auth:refresh:used:";

/** 墓碑保留时间：覆盖住「令牌被复制后延迟重放」的现实窗口即可，无需与令牌等长 */
const USED_TOMBSTONE_TTL_SECONDS = 24 * 60 * 60;

interface StoredRefreshToken {
  userId: number;
  familyId: string;
  /** 只存摘要，不存明文 */
  secretHash: string;
}

export interface IssuedRefreshToken {
  /** 下发给客户端的明文，形如 `<tokenId>.<secret>` */
  token: string;
  expiresInSeconds: number;
}

function tokenKey(tokenId: string) {
  return `${TOKEN_KEY_PREFIX}${tokenId}`;
}
function familyKey(familyId: string) {
  return `${FAMILY_KEY_PREFIX}${familyId}`;
}
function usedKey(tokenId: string) {
  return `${USED_KEY_PREFIX}${tokenId}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** 定长比较，避免按字符提前返回泄露信息 */
function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** 明文格式：`<tokenId>.<secret>`；tokenId 用于定位记录，secret 用于校验 */
function parseToken(raw: string): { tokenId: string; secret: string } | null {
  const idx = raw.indexOf(".");
  if (idx <= 0 || idx === raw.length - 1) return null;
  return { tokenId: raw.slice(0, idx), secret: raw.slice(idx + 1) };
}

/** 签发一枚刷新令牌并登记进指定家族 */
async function issueInFamily(userId: number, familyId: string): Promise<IssuedRefreshToken> {
  const tokenId = randomUUID();
  // randomUUID 提供 122 位熵，足以作为不可猜测的密钥部分；两段拼接后仍是一次性凭证
  const secret = `${randomUUID()}${randomUUID()}`.replace(/-/g, "");

  const record: StoredRefreshToken = { userId, familyId, secretHash: sha256(secret) };

  await redis.set(tokenKey(tokenId), JSON.stringify(record), { EX: REFRESH_TOKEN_TTL_SECONDS });
  await redis.sAdd(familyKey(familyId), tokenId);
  await redis.expire(familyKey(familyId), REFRESH_TOKEN_TTL_SECONDS);

  return { token: `${tokenId}.${secret}`, expiresInSeconds: REFRESH_TOKEN_TTL_SECONDS };
}

/** 登录时调用：开启一个新的令牌家族 */
export async function issueRefreshToken(userId: number): Promise<IssuedRefreshToken> {
  return issueInFamily(userId, randomUUID());
}

/** 撤销整个家族（登出，或检测到重放时） */
export async function revokeRefreshFamily(familyId: string): Promise<void> {
  const tokenIds = await redis.sMembers(familyKey(familyId));
  if (tokenIds.length > 0) {
    await redis.del(tokenIds.map(tokenKey));
  }
  await redis.del(familyKey(familyId));
}

export type RefreshOutcome =
  | { status: "rotated"; userId: number; next: IssuedRefreshToken }
  /** 令牌无效、过期，或已被撤销 */
  | { status: "invalid" }
  /** 检测到重放：家族已被撤销，必须重新登录 */
  | { status: "reused" };

/**
 * 校验并轮换刷新令牌。
 * 成功时旧令牌立即失效，调用方须把返回的新令牌写回 Cookie。
 */
export async function rotateRefreshToken(rawToken: string): Promise<RefreshOutcome> {
  const parsed = parseToken(rawToken);
  if (!parsed) return { status: "invalid" };
  const { tokenId, secret } = parsed;

  const stored = await redis.get(tokenKey(tokenId));

  if (!stored) {
    // 记录不存在但墓碑还在 —— 这枚令牌用过了却又被拿来用，说明它被复制走了
    const tombstone = await redis.get(usedKey(tokenId));
    if (tombstone) {
      logger.warn("refresh_token_reuse_detected", {
        tokenId,
        message: "检测到刷新令牌重放，已撤销该令牌家族，相关会话需要重新登录",
      });
      await revokeRefreshFamily(tombstone);
      return { status: "reused" };
    }
    return { status: "invalid" };
  }

  const record = JSON.parse(stored) as StoredRefreshToken;
  if (!hashesEqual(record.secretHash, sha256(secret))) {
    return { status: "invalid" };
  }

  // 先让旧令牌失效并留下墓碑，再签发新的：即便随后失败，也不会留下两枚同时可用的令牌
  await redis.del(tokenKey(tokenId));
  await redis.set(usedKey(tokenId), record.familyId, { EX: USED_TOMBSTONE_TTL_SECONDS });
  await redis.sRem(familyKey(record.familyId), tokenId);

  const next = await issueInFamily(record.userId, record.familyId);
  return { status: "rotated", userId: record.userId, next };
}

/** 登出：撤销该令牌所属的整个家族（同一次登录派生出的全部令牌） */
export async function revokeRefreshTokenByRaw(rawToken: string): Promise<void> {
  const parsed = parseToken(rawToken);
  if (!parsed) return;

  const stored = await redis.get(tokenKey(parsed.tokenId));
  if (!stored) return;

  const record = JSON.parse(stored) as StoredRefreshToken;
  await revokeRefreshFamily(record.familyId);
}
