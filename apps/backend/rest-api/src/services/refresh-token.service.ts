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
 * - 重放检测：一枚已经用过的刷新令牌再次出现，通常意味着它被复制走了。
 *   此时撤销整个令牌家族（强制重新登录），而不是听任攻击者与真实用户并行持有会话。
 *
 * 但「用过的令牌再次出现」还有一种完全无辜的成因：同一个浏览器的多个标签页
 * （乃至同源部署的门户与管理端两个前端，它们共用同一枚刷新 Cookie）在同一瞬间
 * 拿着同一枚令牌去刷新。若一律按重放处理，用户什么都没做错却被强制登出——
 * 这是轮换式刷新最常见的线上事故。因此轮换后留一段极短的宽限窗口
 * （REFRESH_ROTATION_GRACE_SECONDS，可设 0 关闭）：窗口内视为并发竞态，
 * 在同一家族内补发；窗口外仍旧判定为重放并撤销家族。
 *
 * 无论走哪条路径，都必须先验证令牌明文里的 secret。tokenId 只是定位用的，
 * 它会出现在日志与运维视野里；若仅凭 tokenId 就能触发「撤销家族」，
 * 任何拿到过一条日志的人都能把别人的会话踢下线。
 */
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { REFRESH_ROTATION_GRACE_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "../env.js";
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

/**
 * 轮换后留下的墓碑。
 * 同样带上 secretHash：无论后续被判成并发竞态还是重放，都要先证明来者确实持有原令牌。
 */
interface RefreshTokenTombstone {
  userId: number;
  familyId: string;
  secretHash: string;
  /** 轮换发生的时刻（epoch 毫秒），用于判断是否还在并发宽限窗口内 */
  rotatedAt: number;
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

/** 解析 Redis 里的 JSON 记录；内容损坏时按「记录不存在」处理，不让一条脏数据打崩刷新链路 */
function parseJson<T>(raw: string | null): T | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
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

/** 家族是否仍然存活；已被撤销（登出 / 重放）的家族不能靠宽限窗口复活 */
async function familyIsAlive(familyId: string): Promise<boolean> {
  return (await redis.exists(familyKey(familyId))) === 1;
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
  const secretHash = sha256(secret);

  const stored = parseJson<StoredRefreshToken>(await redis.get(tokenKey(tokenId)));

  if (stored) {
    // secret 不符：在任何写操作之前就返回，别让「只知道 tokenId」的人有能力改动任何状态
    if (!hashesEqual(stored.secretHash, secretHash)) {
      return { status: "invalid" };
    }

    // 墓碑先写、记录后删：并发的两个请求都会走到这里，先写墓碑能保证「晚一步的那个」
    // 一定读得到墓碑，从而走宽限窗口补发，而不是读到一片空白后把用户判成未登录
    const tombstone: RefreshTokenTombstone = {
      userId: stored.userId,
      familyId: stored.familyId,
      secretHash: stored.secretHash,
      rotatedAt: Date.now(),
    };
    await redis.set(usedKey(tokenId), JSON.stringify(tombstone), {
      EX: USED_TOMBSTONE_TTL_SECONDS,
    });
    await redis.del(tokenKey(tokenId));
    await redis.sRem(familyKey(stored.familyId), tokenId);

    const next = await issueInFamily(stored.userId, stored.familyId);
    return { status: "rotated", userId: stored.userId, next };
  }

  // 记录不在了：要么从未存在/已过期，要么已经被轮换掉（此时墓碑还在）
  const tombstone = parseJson<RefreshTokenTombstone>(await redis.get(usedKey(tokenId)));
  if (!tombstone) return { status: "invalid" };

  // 先验证 secret：只知道 tokenId 的人不该有能力触发下面任何一条路径
  if (!hashesEqual(tombstone.secretHash, secretHash)) {
    return { status: "invalid" };
  }

  // 宽限为 0 = 严格模式；不写成 `<= 0` 是因为那会让「同一毫秒内」意外落进宽限分支
  const graceMs = REFRESH_ROTATION_GRACE_SECONDS * 1000;
  const withinGrace = graceMs > 0 && Date.now() - tombstone.rotatedAt <= graceMs;

  if (withinGrace && (await familyIsAlive(tombstone.familyId))) {
    // 多标签页 / 多前端同时刷新的正常竞态：补发一枚同家族令牌，而不是把用户踢下线
    logger.debug("refresh_token_concurrent_rotation", {
      tokenId,
      message: "刷新令牌在宽限窗口内被重复提交，按并发竞态处理并补发新令牌",
    });
    const next = await issueInFamily(tombstone.userId, tombstone.familyId);
    return { status: "rotated", userId: tombstone.userId, next };
  }

  logger.warn("refresh_token_reuse_detected", {
    tokenId,
    message: "检测到刷新令牌重放，已撤销该令牌家族，相关会话需要重新登录",
  });
  await revokeRefreshFamily(tombstone.familyId);
  return { status: "reused" };
}

/**
 * 登出：撤销该令牌所属的整个家族（同一次登录派生出的全部令牌）。
 *
 * 也接受刚被轮换掉的令牌：客户端手里的 Cookie 可能比服务端晚一代
 * （另一个标签页刚刷新过），此时若认不出来，登出就会「看起来成功、实际没撤销」。
 * 两条路径都要求 secret 正确，避免仅凭 tokenId 就能强制他人下线。
 */
export async function revokeRefreshTokenByRaw(rawToken: string): Promise<void> {
  const parsed = parseToken(rawToken);
  if (!parsed) return;
  const secretHash = sha256(parsed.secret);

  const stored = parseJson<StoredRefreshToken>(await redis.get(tokenKey(parsed.tokenId)));
  if (stored) {
    if (!hashesEqual(stored.secretHash, secretHash)) return;
    await revokeRefreshFamily(stored.familyId);
    return;
  }

  const tombstone = parseJson<RefreshTokenTombstone>(await redis.get(usedKey(parsed.tokenId)));
  if (!tombstone) return;
  if (!hashesEqual(tombstone.secretHash, secretHash)) return;
  await revokeRefreshFamily(tombstone.familyId);
}
