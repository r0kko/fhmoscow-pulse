import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class PlayerPosition extends Model {}

PlayerPosition.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'PlayerPosition',
    tableName: 'player_position',
    timestamps: false,
  }
);

PlayerPosition.associate = ({ GamePlayer }) => {
  if (GamePlayer)
    PlayerPosition.hasMany(GamePlayer, { foreignKey: 'position_id' });
};

export default PlayerPosition;
