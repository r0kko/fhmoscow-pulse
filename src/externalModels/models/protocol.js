import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Protocol extends Model {}

Protocol.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    file_id: { type: DataTypes.INTEGER },
    game_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'Protocol',
    tableName: 'protocol',
    timestamps: false,
  }
);

Protocol.associate = ({ ExtFile, Game }) => {
  Protocol.belongsTo(ExtFile, { foreignKey: 'file_id' });
  Protocol.belongsTo(Game, { foreignKey: 'game_id' });
};

export default Protocol;
