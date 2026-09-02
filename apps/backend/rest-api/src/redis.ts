import { createClient } from "redis";

import { REDIS_URL } from "./env.js";
import { logger, serializeError } from "./utils/logger.js";

export const redis = createClient({ url: REDIS_URL });

redis.on("error", (err) => {
  logger.error("redis_client_error", { error: serializeError(err) });
});

/** 并发调用只发起一次真实连接（限流存储会在首次用到时顺带确保连接） */
let connectInFlight: Promise<void> | null = null;

export async function connectRedis() {
  if (redis.isOpen) return;

  connectInFlight ??= (async () => {
    await redis.connect();
    await redis.ping();
    logger.info("redis_connected");
  })().finally(() => {
    connectInFlight = null;
  });

  await connectInFlight;
}

export async function disconnectRedis() {
  if (!redis.isOpen) return;

  await redis.quit();
}
