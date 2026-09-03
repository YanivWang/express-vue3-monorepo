/**
 * 分片上传的归属校验。
 *
 * 关键在「什么时候」校验：multer 是先把分片落盘、再交给 controller 的，
 * 所以归属校验若只写在 controller，别人的分片其实已经写进了对方的任务目录
 * （合并阶段仍会拒绝，但磁盘上已经留下了不该存在的文件）。
 * 这条只能用真实的 multipart 请求验证——纯函数单测看不到中间件的先后顺序。
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dropTestDatabase,
  prepareTestEnv,
  recreateTestDatabase,
  registerAndLogin,
  startTestApi,
  type TestApi,
} from "../test/integration-harness.js";

const DB_NAME = "evm_it_large_upload";
const CHUNK = Buffer.from("evm-large-upload-chunk-payload");
/** 服务端会逐片校验 md5，必须是分片内容的真实摘要 */
const CHUNK_MD5 = createHash("md5").update(CHUNK).digest("hex");
const FILE_MD5 = "fedcba9876543210fedcba9876543210";
/** 整个文件就一片：分片大小取下限 1MB，文件比它小，于是唯一的分片就是「最后一片」 */
const CHUNK_SIZE = 1024 * 1024;
/** 冒名者用**不同**的内容，否则覆写与否在磁盘上看不出差别，用例就抓不住「先写后拒」 */
const STRANGER_CHUNK = Buffer.from("payload-from-someone-else!!!!!");
const STRANGER_CHUNK_MD5 = createHash("md5").update(STRANGER_CHUNK).digest("hex");

let api: TestApi;
let ownerToken: string;
let strangerToken: string;
let uploadId: string;
let uploadsRoot: string;
let chunksTempSegment: string;

async function putChunk(
  token: string,
  id: string,
  index = 0,
  payload: { bytes: Buffer; md5: string } = { bytes: CHUNK, md5: CHUNK_MD5 },
) {
  const form = new FormData();
  form.append("chunk", new Blob([payload.bytes]), "part.bin");
  const res = await fetch(`${api.baseUrl}/api/uploads/large/${id}/chunks/${String(index)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "x-chunk-md5": payload.md5 },
    body: form,
  });
  return { status: res.status, body: (await res.json()) as { msg?: string } };
}

function chunkPathOf(id: string, index: number): string {
  const name = `part-${String(index).padStart(6, "0")}.bin`;
  return path.join(uploadsRoot, chunksTempSegment, FILE_MD5, id, name);
}

beforeAll(async () => {
  prepareTestEnv(DB_NAME);
  await recreateTestDatabase(DB_NAME);
  api = await startTestApi();

  const uploadConfig = await import("../config/upload.config.js");
  const service = await import("../services/large-upload.service.js");
  uploadsRoot = uploadConfig.uploadsRoot;
  chunksTempSegment = service.LARGE_CHUNKS_TEMP_SEGMENT;

  ownerToken = (await registerAndLogin(api, "it_upload_owner")).token;
  strangerToken = (await registerAndLogin(api, "it_upload_stranger")).token;

  const init = await api.request<{ uploadId: string }>("POST", "/api/uploads/large/init", {
    token: ownerToken,
    body: {
      fileName: "movie.bin",
      fileSize: CHUNK.length,
      chunkSize: CHUNK_SIZE,
      fileMd5: FILE_MD5,
    },
  });
  if (init.status !== 200 || !init.body.uploadId) {
    throw new Error(`创建上传任务失败(${String(init.status)}): ${init.body.msg ?? ""}`);
  }
  uploadId = init.body.uploadId;
});

afterAll(async () => {
  await api.close();
  await dropTestDatabase(DB_NAME);
});

describe("分片归属", () => {
  it("任务创建者可以上传分片", async () => {
    const res = await putChunk(ownerToken, uploadId, 0);
    expect(res.status).toBe(200);
    expect(fs.readFileSync(chunkPathOf(uploadId, 0))).toEqual(CHUNK);
  });

  it("他人上传分片被拒，且不会覆写任务创建者已经传好的分片", async () => {
    const res = await putChunk(strangerToken, uploadId, 0, {
      bytes: STRANGER_CHUNK,
      md5: STRANGER_CHUNK_MD5,
    });

    expect(res.status).toBe(403);
    // 关键断言：不是「写完再拒」，而是压根没写——创建者的分片原样还在
    expect(fs.readFileSync(chunkPathOf(uploadId, 0))).toEqual(CHUNK);
  });

  it("不存在的上传任务返回 404", async () => {
    const res = await putChunk(ownerToken, randomUUID(), 0);
    expect(res.status).toBe(404);
  });
});
