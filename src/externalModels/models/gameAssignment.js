import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class GameAssignment extends Model {}

GameAssignment.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    game_id: { type: DataTypes.INTEGER },
    stadium_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'GameAssignment',
    tableName: 'game_assignment',
    timestamps: false,
  }
);

GameAssignment.associate = ({ Game, Stadium }) => {
  GameAssignment.belongsTo(Game, { foreignKey: 'game_id' });
  GameAssignment.belongsTo(Stadium, { foreignKey: 'stadium_id' });
};

export default GameAssignment;
