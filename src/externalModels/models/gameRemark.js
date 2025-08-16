import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class GameRemark extends Model {}

GameRemark.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    game_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'GameRemark',
    tableName: 'game_remark',
    timestamps: false,
  }
);

GameRemark.associate = ({ Game }) => {
  GameRemark.belongsTo(Game, { foreignKey: 'game_id' });
};

export default GameRemark;
