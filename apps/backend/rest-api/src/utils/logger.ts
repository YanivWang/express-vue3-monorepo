import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import winston from "winston";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.resolve(__dirname, "../../logs");

/**
 * 容器里把日志写进容器内文件是反模式：`docker logs` 看不到、容器重建即丢、
 * 日志采集器（Loki / Fluent Bit / CloudWatch）默认只收 stdout。
 * 因此文件落盘改为「显式开启」，默认只走 stdout（12-Factor 的 logs as event streams）。
 * 本地开发想留存文件时设 LOG_TO_FILE=1。
 */
const fileLoggingEnabled = process.env.LOG_TO_FILE === "1";

if (fileLoggingEnabled) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

/** JSON 序列化时 Error 的 message/stack 不可枚举会丢失，转成普通对象再记日志 */
export function serializeError(value: unknown): unknown {
  if (!(value instanceof Error)) {
    return value;
  }
  const err = value as Error & Record<string, unknown>;
  const out: Record<string, unknown> = {
    name: err.name,
    message: err.message,
    stack: err.stack,
  };
  for (const key of Object.keys(err)) {
    if (Object.prototype.hasOwnProperty.call(out, key)) continue;
    const v = err[key];
    out[key] = v instanceof Error ? serializeError(v) : v;
  }
  if ("cause" in err && err.cause !== undefined) {
    const { cause } = err;
    out.cause = cause instanceof Error ? serializeError(cause) : cause;
  }
  return out;
}

const consoleFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaText = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  const primary = stack ?? message;
  let body: string;
  if (typeof primary === "string") {
    body = primary;
  } else if (primary == null) {
    body = "";
  } else if (typeof primary === "object") {
    body = JSON.stringify(primary);
  } else if (typeof primary === "number" || typeof primary === "boolean") {
    body = String(primary);
  } else if (typeof primary === "bigint") {
    body = primary.toString();
  } else if (typeof primary === "symbol") {
    body = primary.description ?? primary.toString();
  } else {
    body = "";
  }
  const tsPart = typeof ts === "string" ? ts : "";
  const levelPart = typeof level === "string" ? level : "";
  return `${tsPart} ${levelPart}: ${body}${metaText}`;
});

const isProduction = process.env.NODE_ENV === "production";

/**
 * stdout 是唯一始终启用的 transport。
 * 生产输出结构化 JSON（便于采集与检索），开发输出带颜色的可读单行。
 */
const consoleTransport = new winston.transports.Console({
  format: isProduction
    ? combine(timestamp(), errors({ stack: true }), json())
    : combine(colorize(), timestamp(), errors({ stack: true }), consoleFormat),
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: [consoleTransport],
});

if (fileLoggingEnabled) {
  // 只记录 error 级别日志
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
    }),
  );
  // 所有日志
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
    }),
  );
}
