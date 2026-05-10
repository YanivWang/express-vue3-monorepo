/** 简书 IT 技术专区左侧 Tab ↔ programmers 接口 type_id（见 webpack techareas bundle） */
export const JIANSU_TECH_SECTIONS = {
  backend: { typeId: 27, leafCategoryName: "后端" },
  frontend: { typeId: 31, leafCategoryName: "前端" },
  android: { typeId: 28, leafCategoryName: "Android" },
  ios: { typeId: 29, leafCategoryName: "iOS" },
  intelligence: { typeId: 30, leafCategoryName: "人工智能" },
  database: { typeId: 32, leafCategoryName: "数据库" },
  programdevelopment: { typeId: 33, leafCategoryName: "程序开发" },
} as const;

export type JianshuSectionKey = keyof typeof JIANSU_TECH_SECTIONS;
