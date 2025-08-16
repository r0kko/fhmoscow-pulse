import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class RefreshTokens extends Model {}

RefreshTokens.init(
  { id: { type: DataTypes.INTEGER, primaryKey: true } },
  {
    sequelize,
    modelName: 'RefreshTokens',
    tableName: 'refresh_tokens',
    timestamps: false,
  }
);

export default RefreshTokens;
