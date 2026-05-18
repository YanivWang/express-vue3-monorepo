/// <reference lib="webworker" />

import SparkMD5 from "spark-md5";

type WorkerInit = {
  type: "init";
  file: File;
  partSize: number;
  readConcurrency: number;
};

type WorkerToMain =
  | { type: "done"; md5: string; durationMs: number }
  | { type: "error"; message: string };

let aborted = false;

function endMessage(msg: WorkerToMain, finishedRef: { v: boolean }) {
  if (finishedRef.v) return;
  finishedRef.v = true;
  self.postMessage(msg);
}

function runImpl(init: WorkerInit, finishedRef: { v: boolean }) {
  const { file, partSize, readConcurrency } = init;
  const t0 = performance.now();
  const spark = new SparkMD5.ArrayBuffer();
  const chunkCount = file.size === 0 ? 0 : Math.ceil(file.size / partSize);

  if (chunkCount === 0) {
    const md5 = spark.end();
    endMessage(
      { type: "done", md5, durationMs: Number((performance.now() - t0).toFixed(1)) },
      finishedRef,
    );
    return;
  }

  const buffers = new Map<number, ArrayBuffer>();
  let nextAppend = 0;
  let nextSchedule = 0;
  let inFlight = 0;

  const tryAppend = () => {
    while (nextAppend < chunkCount && buffers.has(nextAppend)) {
      if (aborted) {
        throw new DOMException("aborted", "AbortError");
      }
      spark.append(buffers.get(nextAppend)!);
      buffers.delete(nextAppend);
      nextAppend++;
    }
  };

  const checkDone = () => {
    if (finishedRef.v) return;
    if (aborted) {
      endMessage({ type: "error", message: "AbortError" }, finishedRef);
      return;
    }
    try {
      tryAppend();
    } catch (e) {
      const message =
        e instanceof DOMException && e.name === "AbortError" ? "AbortError" : String(e);
      endMessage({ type: "error", message }, finishedRef);
      return;
    }
    if (nextAppend === chunkCount && inFlight === 0) {
      try {
        const md5 = spark.end();
        endMessage(
          { type: "done", md5, durationMs: Number((performance.now() - t0).toFixed(1)) },
          finishedRef,
        );
      } catch (e) {
        endMessage(
          { type: "error", message: e instanceof Error ? e.message : String(e) },
          finishedRef,
        );
      }
    }
  };

  const schedule = () => {
    if (finishedRef.v) return;
    if (aborted) {
      endMessage({ type: "error", message: "AbortError" }, finishedRef);
      return;
    }
    while (inFlight < readConcurrency && nextSchedule < chunkCount) {
      const i = nextSchedule++;
      inFlight++;
      const start = i * partSize;
      const end = Math.min(start + partSize, file.size);
      void file
        .slice(start, end)
        .arrayBuffer()
        .then((buf) => {
          inFlight--;
          if (finishedRef.v) return;
          if (aborted) {
            endMessage({ type: "error", message: "AbortError" }, finishedRef);
            return;
          }
          buffers.set(i, buf);
          checkDone();
          schedule();
        })
        .catch((e) => {
          inFlight--;
          if (finishedRef.v) return;
          endMessage(
            { type: "error", message: e instanceof Error ? e.message : String(e) },
            finishedRef,
          );
        });
    }
    checkDone();
  };

  schedule();
}

self.onmessage = (ev: MessageEvent<WorkerInit | { type: "abort" }>) => {
  const data = ev.data;
  if (data.type === "abort") {
    aborted = true;
    return;
  }
  if (data.type !== "init") return;

  aborted = false;
  const finishedRef = { v: false };
  try {
    runImpl(data, finishedRef);
  } catch (e) {
    const message = e instanceof DOMException && e.name === "AbortError" ? "AbortError" : String(e);
    endMessage({ type: "error", message }, finishedRef);
  }
};
