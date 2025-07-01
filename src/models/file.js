import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class File extends Model {}

File.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: { type: DataTypes.STRING(255), allowNull: false },
    original_name: { type: DataTypes.STRING(255), allowNull: false },
    mime_type: { type: DataTypes.STRING(100) },
    size: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'File',
    tableName: 'files',
    paranoid: true,
    underscored: true,
  }
);

export default File;
