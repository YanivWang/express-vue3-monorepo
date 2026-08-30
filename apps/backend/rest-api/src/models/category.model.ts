import { DataTypes, type Model, type Optional, type Sequelize } from "sequelize";

import type { DefinedColumns } from "./model-helpers.js";

/** Categories 表的完整列，与 migrations/0001-initial-schema 保持一致 */
export interface CategoryAttributes {
  id: number;
  name: string;
  /** null 表示一级分类 */
  parentId: number | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CategoryCreationAttributes = Optional<
  CategoryAttributes,
  "id" | "parentId" | "sortOrder" | "createdAt" | "updatedAt"
>;

export type CategoryModel = Model<CategoryAttributes, CategoryCreationAttributes> &
  CategoryAttributes & {
    /** 仅在 include 了对应 as 时存在 */
    parent?: CategoryModel;
    children?: CategoryModel[];
  };

export function defineCategoryModel(sequelize: Sequelize) {
  const Category = sequelize.define<CategoryModel, DefinedColumns<CategoryAttributes>>(
    "Category",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "分类名称",
      },
      parentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "父分类 id；null 表示一级分类",
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "同级排序，越小越靠前",
      },
    },
    {
      indexes: [{ fields: ["parentId"] }],
    },
  );

  Category.belongsTo(Category, {
    foreignKey: "parentId",
    as: "parent",
    onDelete: "RESTRICT",
  });
  Category.hasMany(Category, { foreignKey: "parentId", as: "children" });

  return Category;
}
