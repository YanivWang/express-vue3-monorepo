/** 编辑帖子对话框提交的载荷；组件与 composable 共用，故放在普通模块里 */
export interface PostEditPayload {
  title: string;
  content: string;
  categoryId: number | undefined;
  published: boolean;
}
