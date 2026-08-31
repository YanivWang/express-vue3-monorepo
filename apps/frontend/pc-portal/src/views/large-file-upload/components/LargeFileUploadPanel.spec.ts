import { ElMessage } from "element-plus";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref, shallowRef } from "vue";

import { mountApp } from "@/test/app-harness";
import { button } from "@/test/dom";

import { useLargeFileUpload } from "../composables/useLargeFileUpload";

import LargeFileUploadPanel from "./LargeFileUploadPanel.vue";

import type { LargeFileUploadPhase } from "../types";
import type { Component } from "vue";

/**
 * LargeFileUploadPanel 的行为基线（写在拆分之前，拆分后不得修改）。
 *
 * 面板自己不搬字节，真正的分片、重试、暂停都在 useLargeFileUpload 里，
 * 因此这里把引擎整体挡掉，只压面板真正负责的两件事：
 * 六个按钮在八种 phase 下的可用性状态机，以及成功/失败/取消三条出口的提示与 emit。
 * 这两块恰恰是拆分时最容易漏掉一个分支的地方。
 */

vi.mock("../composables/useLargeFileUpload", () => ({
  LARGE_UPLOAD_DEFAULT_CHUNK_BYTES: 5 * 1024 * 1024,
  LARGE_UPLOAD_DEFAULT_CONCURRENCY: 4,
  LARGE_UPLOAD_DEFAULT_MAX_RETRIES: 2,
  useLargeFileUpload: vi.fn(),
}));

const infoSpy = vi.spyOn(ElMessage, "info").mockImplementation(() => ({ close: () => {} }));

interface UploadStubOptions {
  phase?: LargeFileUploadPhase;
  progress?: number;
  errorMessage?: string | null;
  resultUrl?: string | null;
  hashDurationMs?: number | null;
  uploadTotalDurationMs?: number | null;
  canResume?: boolean;
  lastFile?: File | null;
}

function createUploadStub(options: UploadStubOptions = {}) {
  const stub = {
    phase: ref<LargeFileUploadPhase>(options.phase ?? "idle"),
    progress: ref(options.progress ?? 0),
    errorMessage: ref<string | null>(options.errorMessage ?? null),
    resultUrl: ref<string | null>(options.resultUrl ?? null),
    hashDurationMs: ref<number | null>(options.hashDurationMs ?? null),
    uploadTotalDurationMs: ref<number | null>(options.uploadTotalDurationMs ?? null),
    currentUploadId: shallowRef<string | null>(null),
    lastFile: shallowRef<File | null>(options.lastFile ?? null),
    canResume: ref(options.canResume ?? false),
    progressBarInstanceKey: ref(0),
    uploadFile: vi.fn(),
    retryResume: vi.fn(),
    afterPickerSelectedFile: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn(),
  };
  // canResume 在真身里是 ComputedRef，用例需要直接摆布它，故以 Ref 顶替后断言式转换
  vi.mocked(useLargeFileUpload).mockReturnValue(
    stub as unknown as ReturnType<typeof useLargeFileUpload>,
  );
  return stub;
}

async function mountPanel(options: UploadStubOptions = {}) {
  const stub = createUploadStub(options);
  const { wrapper } = await mountApp(LargeFileUploadPanel as Component, {});
  return { wrapper, stub };
}

function makeFile(name = "big.bin", size = 3 * 1024 * 1024): File {
  const file = new File(["x"], name, { type: "application/octet-stream" });
  // File 构造出来的 size 由内容决定，这里直接摆布成用例想要的大小
  Object.defineProperty(file, "size", { value: size, configurable: true });
  return file;
}

/**
 * helper 的参数按「实际用到的那点接口」声明，而不是 VueWrapper。
 * mountApp 返回的是 VueWrapper<any, any>，标成具体包装类型会触发 no-unsafe-argument；
 * 结构化签名同时也让 helper 不依赖测试库的具体类型（与既有 spec 的写法一致）。
 */
async function selectFile(
  wrapper: { find: (s: string) => { element: Element; trigger: (e: string) => Promise<void> } },
  file: File,
) {
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, "files", { value: [file], configurable: true });
  await input.trigger("change");
}

function isDisabled(wrapper: Parameters<typeof button>[0], label: string): boolean {
  return button(wrapper, label).attributes("disabled") !== undefined;
}

beforeEach(() => {
  infoSpy.mockClear();
});

describe("LargeFileUploadPanel / 参数透传", () => {
  it("把分片大小、并发与重试次数原样交给上传引擎", async () => {
    createUploadStub();
    await mountApp(LargeFileUploadPanel as Component, {
      props: { chunkSize: 1024 * 1024, concurrency: 2, maxRetries: 5 },
    });

    expect(useLargeFileUpload).toHaveBeenCalledWith({
      chunkSize: 1024 * 1024,
      concurrency: 2,
      maxRetries: 5,
    });
  });

  it("不传参数时用引擎导出的默认值", async () => {
    await mountPanel();

    expect(useLargeFileUpload).toHaveBeenCalledWith({
      chunkSize: 5 * 1024 * 1024,
      concurrency: 4,
      maxRetries: 2,
    });
  });
});

describe("LargeFileUploadPanel / 按钮状态机", () => {
  it("空闲态：可选文件，其余动作都不可用", async () => {
    const { wrapper } = await mountPanel({ phase: "idle" });

    expect(isDisabled(wrapper, "选择文件")).toBe(false);
    expect(isDisabled(wrapper, "开始上传")).toBe(true);
    expect(isDisabled(wrapper, "暂停")).toBe(true);
    expect(isDisabled(wrapper, "继续")).toBe(true);
    expect(isDisabled(wrapper, "取消")).toBe(true);
  });

  it("选中文件后才允许开始上传", async () => {
    const { wrapper } = await mountPanel({ phase: "idle" });
    expect(isDisabled(wrapper, "开始上传")).toBe(true);

    await selectFile(wrapper, makeFile());

    expect(isDisabled(wrapper, "开始上传")).toBe(false);
  });

  it("上传中：不许重选文件也不许重复开始，只能暂停或取消", async () => {
    const { wrapper } = await mountPanel({ phase: "uploading" });

    expect(isDisabled(wrapper, "选择文件")).toBe(true);
    expect(isDisabled(wrapper, "开始上传")).toBe(true);
    expect(isDisabled(wrapper, "暂停")).toBe(false);
    expect(isDisabled(wrapper, "继续")).toBe(true);
    expect(isDisabled(wrapper, "取消")).toBe(false);
  });

  it("暂停态：可继续、可取消，但不能重选文件", async () => {
    const { wrapper } = await mountPanel({ phase: "paused" });

    expect(isDisabled(wrapper, "选择文件")).toBe(true);
    expect(isDisabled(wrapper, "继续")).toBe(false);
    expect(isDisabled(wrapper, "暂停")).toBe(true);
    expect(isDisabled(wrapper, "取消")).toBe(false);
  });

  it("合并中：只剩取消可用", async () => {
    const { wrapper } = await mountPanel({ phase: "merging" });

    expect(isDisabled(wrapper, "选择文件")).toBe(true);
    expect(isDisabled(wrapper, "暂停")).toBe(true);
    expect(isDisabled(wrapper, "继续")).toBe(true);
    expect(isDisabled(wrapper, "取消")).toBe(false);
  });

  it("完成与出错后重新允许选择文件", async () => {
    const done = await mountPanel({ phase: "done" });
    expect(isDisabled(done.wrapper, "选择文件")).toBe(false);

    const failed = await mountPanel({ phase: "error" });
    expect(isDisabled(failed.wrapper, "选择文件")).toBe(false);
  });

  it("断点续传按钮只在引擎说可续传时出现", async () => {
    const hidden = await mountPanel({ canResume: false });
    expect(hidden.wrapper.findAll("button").map((b) => b.text())).not.toContain("断点续传");

    const shown = await mountPanel({ canResume: true, phase: "error" });
    expect(shown.wrapper.findAll("button").map((b) => b.text())).toContain("断点续传");
  });

  it("暂停、继续、取消分别转交给引擎的同名动作", async () => {
    const uploading = await mountPanel({ phase: "uploading" });
    await button(uploading.wrapper, "暂停").trigger("click");
    expect(uploading.stub.pause).toHaveBeenCalledTimes(1);
    await button(uploading.wrapper, "取消").trigger("click");
    expect(uploading.stub.cancel).toHaveBeenCalledTimes(1);

    const paused = await mountPanel({ phase: "paused" });
    await button(paused.wrapper, "继续").trigger("click");
    expect(paused.stub.resume).toHaveBeenCalledTimes(1);
  });
});

describe("LargeFileUploadPanel / 选择文件", () => {
  it("展示已选文件的名字与体积", async () => {
    const { wrapper } = await mountPanel();

    await selectFile(wrapper, makeFile("视频.mp4", 3 * 1024 * 1024));

    const pending = wrapper.find(".large-file-upload-panel__pending").text();
    expect(pending).toContain("视频.mp4");
    expect(pending).toContain("3.00 MB");
  });

  it("未选文件时已选一栏是占位符", async () => {
    const { wrapper } = await mountPanel();

    expect(wrapper.find(".large-file-upload-panel__pending").text()).toContain("—");
  });

  it("选中后立刻通知引擎，便于它预判秒传或续传", async () => {
    const { wrapper, stub } = await mountPanel();
    const file = makeFile();

    await selectFile(wrapper, file);

    expect(stub.afterPickerSelectedFile).toHaveBeenCalledWith(file);
  });
});

describe("LargeFileUploadPanel / 上传出口", () => {
  it("成功后提示完成、清空已选并把结果 emit 出去", async () => {
    const { wrapper, stub } = await mountPanel({
      hashDurationMs: 1200,
      uploadTotalDurationMs: 8000,
    });
    stub.uploadFile.mockResolvedValue({ url: "https://cdn.test/big.bin" });
    await selectFile(wrapper, makeFile("big.bin", 3 * 1024 * 1024));

    await button(wrapper, "开始上传").trigger("click");
    await new Promise((r) => setTimeout(r, 0));

    expect(stub.uploadFile).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("success")).toEqual([
      [
        {
          url: "https://cdn.test/big.bin",
          fileName: "big.bin",
          size: 3 * 1024 * 1024,
          hashDurationMs: 1200,
          uploadTotalDurationMs: 8000,
        },
      ],
    ]);
    expect(wrapper.find(".large-file-upload-panel__pending").text()).not.toContain("big.bin");
  });

  it("失败时报出引擎给的原因并 emit error", async () => {
    const { wrapper, stub } = await mountPanel();
    stub.uploadFile.mockRejectedValue(new Error("分片校验不通过"));
    await selectFile(wrapper, makeFile());

    await button(wrapper, "开始上传").trigger("click");
    await new Promise((r) => setTimeout(r, 0));

    expect(wrapper.emitted("error")).toHaveLength(1);
    expect(wrapper.emitted("success")).toBeUndefined();
  });

  it("用户主动取消不算失败：只提示已取消，不 emit error", async () => {
    const { wrapper, stub } = await mountPanel();
    stub.uploadFile.mockImplementation(() => {
      stub.phase.value = "canceled";
      return Promise.reject(new Error("已取消"));
    });
    await selectFile(wrapper, makeFile());

    await button(wrapper, "开始上传").trigger("click");
    await new Promise((r) => setTimeout(r, 0));

    expect(infoSpy).toHaveBeenCalledWith("已取消上传");
    expect(wrapper.emitted("error")).toBeUndefined();
    expect(wrapper.emitted("success")).toBeUndefined();
  });

  it("未选文件时点开始上传什么也不做", async () => {
    const { wrapper, stub } = await mountPanel({ phase: "done" });

    await button(wrapper, "开始上传").trigger("click");
    await new Promise((r) => setTimeout(r, 0));

    expect(stub.uploadFile).not.toHaveBeenCalled();
  });
});

describe("LargeFileUploadPanel / 断点续传出口", () => {
  it("续传成功时用引擎记住的文件信息 emit success", async () => {
    const remembered = makeFile("resumed.bin", 7 * 1024 * 1024);
    const { wrapper, stub } = await mountPanel({
      canResume: true,
      phase: "error",
      lastFile: remembered,
      hashDurationMs: 900,
      uploadTotalDurationMs: 4200,
    });
    stub.retryResume.mockResolvedValue({ url: "https://cdn.test/resumed.bin" });

    await button(wrapper, "断点续传").trigger("click");
    await new Promise((r) => setTimeout(r, 0));

    expect(stub.retryResume).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("success")).toEqual([
      [
        {
          url: "https://cdn.test/resumed.bin",
          fileName: "resumed.bin",
          size: 7 * 1024 * 1024,
          hashDurationMs: 900,
          uploadTotalDurationMs: 4200,
        },
      ],
    ]);
  });

  it("续传失败时 emit error", async () => {
    const { wrapper, stub } = await mountPanel({ canResume: true, phase: "error" });
    stub.retryResume.mockRejectedValue(new Error("服务端已清理该任务"));

    await button(wrapper, "断点续传").trigger("click");
    await new Promise((r) => setTimeout(r, 0));

    expect(wrapper.emitted("error")).toHaveLength(1);
    expect(wrapper.emitted("success")).toBeUndefined();
  });
});

describe("LargeFileUploadPanel / 指标与结果", () => {
  it("耗时未知时显示占位符", async () => {
    const { wrapper } = await mountPanel();

    const metrics = wrapper.find(".large-file-upload-panel__metrics").text();
    expect(metrics).toContain("MD5 计算耗时：—");
    expect(metrics).toContain("总共耗时（开始至结束）：—");
  });

  it("满一秒的耗时按秒展示，不足一秒按毫秒展示", async () => {
    const { wrapper } = await mountPanel({ hashDurationMs: 2500, uploadTotalDurationMs: 750.4 });

    const metrics = wrapper.find(".large-file-upload-panel__metrics").text();
    expect(metrics).toContain("2.50 s");
    expect(metrics).toContain("750 ms");
  });

  it("当前阶段直接显示给用户", async () => {
    const { wrapper } = await mountPanel({ phase: "merging" });

    expect(wrapper.find(".large-file-upload-panel__phase").text()).toBe("状态：merging");
  });

  it("空闲态进度条归零，避免上一轮的 100% 残留", async () => {
    const { wrapper } = await mountPanel({ phase: "idle", progress: 87 });

    expect(wrapper.find(".el-progress__text").text()).toBe("0%");
  });

  it("上传中按引擎进度展示，且不越过 100%", async () => {
    const running = await mountPanel({ phase: "uploading", progress: 42 });
    expect(running.wrapper.find(".el-progress__text").text()).toBe("42%");

    const overflow = await mountPanel({ phase: "merging", progress: 130 });
    expect(overflow.wrapper.find(".el-progress__text").text()).toBe("100%");
  });

  it("错误信息渲染在告警区", async () => {
    const { wrapper } = await mountPanel({ errorMessage: "第 3 片重试耗尽" });

    expect(wrapper.find(".large-file-upload-panel__err").text()).toBe("第 3 片重试耗尽");
  });

  it("拿到结果地址后渲染为可点击链接", async () => {
    const { wrapper } = await mountPanel({ resultUrl: "https://cdn.test/ok.bin" });

    const link = wrapper.find(".large-file-upload-panel__ok a");
    expect(link.attributes("href")).toBe("https://cdn.test/ok.bin");
    expect(link.text()).toBe("https://cdn.test/ok.bin");
  });

  it("没有结果地址时显示占位符而不是空链接", async () => {
    const { wrapper } = await mountPanel();

    expect(wrapper.find(".large-file-upload-panel__ok a").exists()).toBe(false);
    expect(wrapper.find(".large-file-upload-panel__ok").text()).toContain("—");
  });
});
