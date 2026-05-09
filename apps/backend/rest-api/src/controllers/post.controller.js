import {
  createPost,
  findMyPostsPage,
  findPostByIdPublic,
  findPostsPagePublic,
  removePostById,
  updatePostById,
} from "../services/post.service.js";
import { success } from "../utils/response.js";

export async function getPosts(req, res) {
  const { page, limit, parentId, categoryId } = req.query;
  const { posts, total, totalPages } = await findPostsPagePublic(page, limit, {
    parentId,
    categoryId,
  });
  const hasNext = totalPages > 0 && page < totalPages;
  return success(res, "获取文章列表成功", {
    posts,
    pagination: { page, limit, total, totalPages, hasNext },
  });
}

export async function getMyPosts(req, res) {
  const { page, limit, parentId, categoryId } = req.query;
  const { posts, total, totalPages } = await findMyPostsPage(req.user.id, page, limit, {
    parentId,
    categoryId,
  });
  const hasNext = totalPages > 0 && page < totalPages;
  return success(res, "获取我的文章成功", {
    posts,
    pagination: { page, limit, total, totalPages, hasNext },
  });
}

export async function getPost(req, res) {
  const post = await findPostByIdPublic(req.params.id, req.user?.id ?? null);
  return success(res, "获取文章成功", { post });
}

export async function addPost(req, res) {
  const post = await createPost(req.user.id, req.body);
  return success(res, "创建文章成功", { post });
}

export async function patchPost(req, res) {
  const post = await updatePostById(req.params.id, req.user, req.body);
  return success(res, "更新文章成功", { post });
}

export async function deletePost(req, res) {
  await removePostById(req.params.id, req.user);
  return success(res, "删除文章成功");
}
