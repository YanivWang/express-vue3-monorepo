import { DataTypes, type Sequelize } from "sequelize";

export function defineCategoryModel(sequelize: Sequelize) {
  const Category = sequelize.define(
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
