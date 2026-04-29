import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class IasEvent extends Model {}

IasEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    registry_number: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    date_start: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    date_end: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    source: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'IAS',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'IasEvent',
    tableName: 'ias_events',
    paranoid: true,
    underscored: true,
  }
);

export default IasEvent;
