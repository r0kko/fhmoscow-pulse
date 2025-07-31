import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class NormativeTicket extends Model {}

NormativeTicket.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    season_id: { type: DataTypes.UUID, allowNull: false },
    type_id: { type: DataTypes.UUID, allowNull: false },
    value: { type: DataTypes.FLOAT, allowNull: false },
    ticket_id: { type: DataTypes.UUID, allowNull: false },
    normative_result_id: { type: DataTypes.UUID },
  },
  {
    sequelize,
    modelName: 'NormativeTicket',
    tableName: 'normative_tickets',
    paranoid: true,
    underscored: true,
  }
);

export default NormativeTicket;
