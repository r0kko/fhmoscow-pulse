import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TrainingType extends Model {}

TrainingType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    default_capacity: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'TrainingType',
    tableName: 'training_types',
    paranoid: true,
    underscored: true,
  }
);

export default TrainingType;
