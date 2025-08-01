import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TicketType extends Model {}

TicketType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'TicketType',
    tableName: 'ticket_types',
    paranoid: true,
    underscored: true,
  }
);

export default TicketType;
