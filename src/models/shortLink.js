import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class ShortLink extends Model {}

ShortLink.init(
  {
    code: {
      type: DataTypes.STRING(32),
      allowNull: false,
      primaryKey: true,
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    hits: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: 'ShortLink',
    tableName: 'short_links',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['code'] },
      { unique: true, fields: ['token'] },
      { fields: ['expires_at'] },
    ],
  }
);

export default ShortLink;
