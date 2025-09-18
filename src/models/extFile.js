import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class ExtFile extends Model {}

ExtFile.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    module: { type: DataTypes.STRING(255) },
    name: { type: DataTypes.STRING(255) },
    mime_type: { type: DataTypes.STRING(255) },
    size: { type: DataTypes.INTEGER },
    object_status: { type: DataTypes.STRING(255) },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
  },
  {
    sequelize,
    modelName: 'ExtFile',
    tableName: 'ext_files',
    paranoid: true,
    underscored: true,
  }
);

export default ExtFile;
