import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchBroadcastLink extends Model {}

MatchBroadcastLink.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    match_id: { type: DataTypes.UUID, allowNull: false },
    url: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: 'MatchBroadcastLink',
    tableName: 'match_broadcast_links',
    paranoid: true,
    underscored: true,
  }
);

export default MatchBroadcastLink;
