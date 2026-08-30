import { ElMessage, ElMessageBox, type MessageBoxData } from "element-plus";
import { vi } from "vitest";

/**
 * Element Plus 的两个「命令式服务」在测试里换成 spy。
 *
 * 注意这与「组件真实挂载」并不矛盾：el-button / el-input 这些仍是真身，
 * 只有 ElMessage / ElMessageBox 例外——它们把 DOM 挂到 document.body 上、
 * 不属于任一 wrapper，断言要绕一大圈；而用例真正关心的只是
 * 「有没有弹确认框」「提示了什么文案」，spy 表达得更直接。
 *
 * 由 src/test/setup.ts 导入以产生副作用，每个测试文件各拿一份新的 spy。
 */

export const messageSpies = {
  success: vi.spyOn(ElMessage, "success").mockImplementation(() => ({ close: () => {} })),
  warning: vi.spyOn(ElMessage, "warning").mockImplementation(() => ({ close: () => {} })),
  error: vi.spyOn(ElMessage, "error").mockImplementation(() => ({ close: () => {} })),
};

/**
 * Element Plus 把确认框的返回类型写成 `MessageBoxInputData & Action`——
 * 一个「既是对象又是字符串字面量」的交叉类型，现实中不存在满足它的值。
 * 运行时确认返回的就是字符串 "confirm"，这里只能按运行时事实断言。
 */
const CONFIRM_RESULT = "confirm" as unknown as MessageBoxData;

/** 默认「用户点了确定」；需要测取消分支的用例用 rejectNextConfirm 覆盖。 */
export const confirmSpy = vi.spyOn(ElMessageBox, "confirm").mockResolvedValue(CONFIRM_RESULT);

/** 让下一次确认框表现为「用户取消」（Element Plus 以 reject 表达取消）。 */
export function rejectNextConfirm(): void {
  confirmSpy.mockRejectedValueOnce(new Error("cancel"));
}
