import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class NormativeResult extends Model {}

NormativeResult.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    season_id: { type: DataTypes.UUID, allowNull: false },
    training_id: { type: DataTypes.UUID },
    type_id: { type: DataTypes.UUID, allowNull: false },
    value_type_id: { type: DataTypes.UUID, allowNull: false },
    unit_id: { type: DataTypes.UUID, allowNull: false },
    zone_id: { type: DataTypes.UUID },
    value: { type: DataTypes.FLOAT, allowNull: false },
  },
  {
    sequelize,
    modelName: 'NormativeResult',
    tableName: 'normative_results',
    paranoid: true,
    underscored: true,
  }
);

export default NormativeResult;
