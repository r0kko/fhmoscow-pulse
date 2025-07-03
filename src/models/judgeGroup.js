import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class JudgeGroup extends Model {}

JudgeGroup.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    season_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'JudgeGroup',
    tableName: 'judge_groups',
    paranoid: true,
    underscored: true,
  }
);

export default JudgeGroup;
