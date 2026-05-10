import type { ArticleRow, SecondaryDef } from "./types";

export const PAGE_SIZE = 5;

const REWARDS = ["0.8", "1.1", "1.3", "2.0", "2.1", "3.1"] as const;

export function categoryLabel(slug: string): string {
  const m: Record<string, string> = {
    backend: "后端",
    frontend: "前端",
    android: "Android",
    ios: "iOS",
    intelligence: "人工智能",
    database: "数据库",
    programdevelopment: "程序开发",
  };
  return m[slug] ?? slug;
}

function makePostsForSecondary(slug: string): ArticleRow[] {
  return Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    return {
      id: `${slug}-${n}`,
      title: `${categoryLabel(slug)}实战手记 ${n}：从典型场景到工程化落地要点`,
      summary: `本文为「${categoryLabel(slug)}」分类下的列表演示数据（第 ${n} 条）。生产环境应由接口按子分类与页码分页返回；替换字段即可对接后端。`,
      reward: REWARDS[i % REWARDS.length],
      author: `${categoryLabel(slug)}作者_${n}`,
      comments: 8 + n * 4,
      likes: 36 + n * 21,
    };
  });
}

/** 演示：「技术」一级下的二级分类及文章列表 */
export const demoSecondaryCategories: SecondaryDef[] = [
  { slug: "backend", label: "后端", posts: makePostsForSecondary("backend") },
  { slug: "frontend", label: "前端", posts: makePostsForSecondary("frontend") },
  { slug: "android", label: "Android", posts: makePostsForSecondary("android") },
  { slug: "ios", label: "iOS", posts: makePostsForSecondary("ios") },
  { slug: "intelligence", label: "人工智能", posts: makePostsForSecondary("intelligence") },
  { slug: "database", label: "数据库", posts: makePostsForSecondary("database") },
  {
    slug: "programdevelopment",
    label: "程序开发",
    posts: makePostsForSecondary("programdevelopment"),
  },
];
