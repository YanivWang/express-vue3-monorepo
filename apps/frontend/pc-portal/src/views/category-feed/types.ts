export type ArticleRow = {
  id: string;
  title: string;
  summary: string;
  reward: string;
  author: string;
  comments: number;
  likes: number;
};

export type SecondaryDef = { slug: string; label: string; posts: ArticleRow[] };

/** 顶栏一级入口标识（演示用，可对接路由或 CMS） */
export type PrimaryKey = "home" | "discover" | "library" | "tech";
