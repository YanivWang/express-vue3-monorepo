import { DataTypes } from "sequelize";

export function defineUserModel(sequelize) {
  return sequelize.define("User", {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });
}
