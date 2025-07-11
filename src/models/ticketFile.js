import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TicketFile extends Model {}

TicketFile.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticket_id: { type: DataTypes.UUID, allowNull: false },
    file_id: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'TicketFile',
    tableName: 'ticket_files',
    paranoid: true,
    underscored: true,
  }
);

export default TicketFile;
