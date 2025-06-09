import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Log extends Model {}

Log.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    method: { type: DataTypes.STRING(10), allowNull: false },
    path: { type: DataTypes.STRING(2048), allowNull: false },
    status_code: { type: DataTypes.SMALLINT, allowNull: false },
    ip: { type: DataTypes.STRING(45) },
    user_agent: { type: DataTypes.STRING(512) },
    response_time: { type: DataTypes.INTEGER },
    request_body: { type: DataTypes.JSONB },
    response_body: { type: DataTypes.JSONB },
  },
  {
    sequelize,
    modelName: 'Log',
    tableName: 'logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  }
);

export default Log;
