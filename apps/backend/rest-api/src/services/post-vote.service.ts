import { Transaction } from "sequelize";

import { Post, PostVote, sequelize } from "../db.js";
import { createHttpError } from "../middlewares/error.middleware.js";

export type PostVoteChoice = "like" | "dislike" | "none";

export async function setPostVote(userId: number, postId: number, choice: PostVoteChoice) {
  const post = await Post.findByPk(postId);
  if (!post || !(post.get("published") as boolean)) {
    throw createHttpError(404, "文章不存在");
  }

  await sequelize.transaction(async (t: Transaction) => {
    let likeDelta = 0;
    let dislikeDelta = 0;

    const prev = await PostVote.findOne({
      where: { postId, userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const prevVal = prev == null ? null : Number(prev.get("value"));

    if (choice === "none") {
      if (!prev) return;
      if (prevVal === 1) likeDelta -= 1;
      else if (prevVal === -1) dislikeDelta -= 1;
      await prev.destroy({ transaction: t });
    } else {
      const next = choice === "like" ? 1 : -1;
      if (prev == null) {
        await PostVote.create({ postId, userId, value: next }, { transaction: t });
        if (next === 1) likeDelta += 1;
        else dislikeDelta += 1;
      } else if (prevVal !== next) {
        if (prevVal === 1) likeDelta -= 1;
        if (prevVal === -1) dislikeDelta -= 1;
        if (next === 1) likeDelta += 1;
        else dislikeDelta += 1;
        await prev.update({ value: next }, { transaction: t });
      }
    }

    if (likeDelta !== 0 || dislikeDelta !== 0) {
      await Post.increment(
        { likeCount: likeDelta, dislikeCount: dislikeDelta },
        { where: { id: postId }, transaction: t },
      );
    }
  });
}

export function voteValueToMyVote(value: number | null | undefined): "like" | "dislike" | null {
  if (value === 1) return "like";
  if (value === -1) return "dislike";
  return null;
}
