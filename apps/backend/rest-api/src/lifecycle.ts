/**
 * 进程生命周期状态。
 *
 * 单独成模块，是为了让 `server.ts`（写入方）与就绪探针（读取方）共享同一个标志位，
 * 而不必让路由去 import server.ts —— 那会把「启动进程」拖进任何 import 了路由的地方，
 * 包括测试与工具脚本。
 */

let shuttingDown = false;

/** 收到 SIGTERM/SIGINT 后由 server.ts 调用；不可逆 */
export function markShuttingDown(): void {
  shuttingDown = true;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

/**
 * 仅供测试：把状态复位。
 * 生产路径上没有「取消退出」这回事，所以正式代码里不该有它的调用点。
 */
export function resetLifecycleForTests(): void {
  shuttingDown = false;
}
