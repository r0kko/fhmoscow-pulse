import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Training extends Model {}

Training.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type_id: { type: DataTypes.UUID, allowNull: false },
    season_id: { type: DataTypes.UUID, allowNull: false },
    start_at: { type: DataTypes.DATE, allowNull: false },
    end_at: { type: DataTypes.DATE, allowNull: false },
    capacity: { type: DataTypes.INTEGER },
    camp_stadium_id: { type: DataTypes.UUID },
    attendance_marked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'Training',
    tableName: 'trainings',
    paranoid: true,
    underscored: true,
  }
);

export default Training;
