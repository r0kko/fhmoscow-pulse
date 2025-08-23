import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Stage extends Model {}

Stage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    tournament_id: { type: DataTypes.UUID },
  },
  {
    sequelize,
    modelName: 'Stage',
    tableName: 'stages',
    paranoid: true,
    underscored: true,
  }
);

export default Stage;
