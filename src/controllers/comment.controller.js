import { createComment, findCommentsPageByPost, removeComment } from "../services/comment.service.js";
import { success } from "../utils/response.js";

export async function getComments(req, res) {
  const { postId } = req.params;
  const { page, limit } = req.query;
  const viewerUserId = req.user?.id ?? null;
  const { comments, total, totalPages } = await findCommentsPageByPost(postId, viewerUserId, page, limit);
  const hasNext = totalPages > 0 && page < totalPages;
  return success(res, "获取评论列表成功", {
    comments,
    pagination: { page, limit, total, totalPages, hasNext },
  });
}

export async function addComment(req, res) {
  const { postId } = req.params;
  const comment = await createComment(postId, req.user.id, req.body);
  return success(res, "发表评论成功", { comment });
}

export async function deleteComment(req, res) {
  const { postId, commentId } = req.params;
  await removeComment(postId, commentId, req.user);
  return success(res, "删除评论成功");
}
