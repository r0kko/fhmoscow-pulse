import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Stage extends Model {}

Stage.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    tournament_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'Stage',
    tableName: 'stage',
    timestamps: false,
  }
);

Stage.associate = ({ Tournament }) => {
  Stage.belongsTo(Tournament, { foreignKey: 'tournament_id' });
};

export default Stage;
