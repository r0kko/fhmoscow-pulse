import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TrainingRole extends Model {}

TrainingRole.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'TrainingRole',
    tableName: 'training_roles',
    paranoid: true,
    underscored: true,
  }
);

export default TrainingRole;
