import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TicketStatus extends Model {}

TicketStatus.init(
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
    modelName: 'TicketStatus',
    tableName: 'ticket_statuses',
    paranoid: true,
    underscored: true,
  }
);

export default TicketStatus;
