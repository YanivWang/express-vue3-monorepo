import { Post, User } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";

const authorAttributes = ["id", "username", "avatar"];

async function findPostOrThrow(id, { allowUnpublished = false, viewerUserId = null } = {}) {
  const post = await Post.findByPk(id, {
    include: [{ model: User, as: "author", attributes: authorAttributes }],
  });

  if (!post) {
    throw createHttpError(404, "文章不存在");
  }

  if (!allowUnpublished && !post.published) {
    const isAuthor = viewerUserId != null && Number(post.authorId) === Number(viewerUserId);
    if (!isAuthor) {
      throw createHttpError(404, "文章不存在");
    }
  }

  return post;
}

function canEdit(post, operator) {
  const uid = Number(operator.id);
  if (Number(post.authorId) === uid) return true;
  return operator.role === 1;
}

export async function findPostsPagePublic(page, limit) {
  const offset = (page - 1) * limit;
  const where = { published: true };
  const [rows, total] = await Promise.all([
    Post.findAll({
      where,
      limit,
      offset,
      order: [["id", "DESC"]],
      include: [{ model: User, as: "author", attributes: authorAttributes }],
    }),
    Post.count({ where }),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { posts: rows, total, totalPages };
}

export async function findPostByIdPublic(id, viewerUserId) {
  return findPostOrThrow(id, { allowUnpublished: false, viewerUserId });
}

export async function findMyPostsPage(userId, page, limit) {
  const offset = (page - 1) * limit;
  const where = { authorId: userId };
  const [rows, total] = await Promise.all([
    Post.findAll({
      where,
      limit,
      offset,
      order: [["id", "DESC"]],
      include: [{ model: User, as: "author", attributes: authorAttributes }],
    }),
    Post.count({ where }),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { posts: rows, total, totalPages };
}

export async function createPost(authorId, payload) {
  const title = String(payload.title ?? "").trim();
  const content = String(payload.content ?? "").trim();
  if (!title || !content) {
    throw createHttpError(400, "标题或正文不能为空");
  }

  const post = await Post.create({
    title,
    content,
    published: Boolean(payload.published),
    authorId,
  });

  return Post.findByPk(post.id, {
    include: [{ model: User, as: "author", attributes: authorAttributes }],
  });
}

export async function updatePostById(postId, operator, payload) {
  const post = await Post.findByPk(postId);
  if (!post) {
    throw createHttpError(404, "文章不存在");
  }

  const user = await User.findByPk(operator.id);
  if (!user) {
    throw createHttpError(401, "未登录或登录已过期");
  }

  if (!canEdit(post, { id: user.id, role: user.role })) {
    throw createHttpError(403, "无权修改该文章");
  }

  const next = {
    ...(payload.title !== undefined ? { title: String(payload.title).trim() } : {}),
    ...(payload.content !== undefined ? { content: String(payload.content).trim() } : {}),
    ...(payload.published !== undefined ? { published: Boolean(payload.published) } : {}),
  };

  if (Object.keys(next).length === 0) {
    throw createHttpError(400, "没有要更新的字段");
  }

  await post.update(next);

  return Post.findByPk(post.id, {
    include: [{ model: User, as: "author", attributes: authorAttributes }],
  });
}

export async function removePostById(postId, operator) {
  const post = await Post.findByPk(postId);
  if (!post) {
    throw createHttpError(404, "文章不存在");
  }

  const user = await User.findByPk(operator.id);
  if (!user) {
    throw createHttpError(401, "未登录或登录已过期");
  }

  if (!canEdit(post, { id: user.id, role: user.role })) {
    throw createHttpError(403, "无权删除该文章");
  }

  await post.destroy();
}
