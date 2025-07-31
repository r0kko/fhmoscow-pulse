import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Ticket extends Model {}

Ticket.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    number: { type: DataTypes.STRING, allowNull: false, unique: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    type_id: { type: DataTypes.UUID, allowNull: false },
    status_id: { type: DataTypes.UUID, allowNull: false },
    description: { type: DataTypes.TEXT },
  },
  {
    sequelize,
    modelName: 'Ticket',
    tableName: 'tickets',
    paranoid: true,
    underscored: true,
  }
);

export default Ticket;
