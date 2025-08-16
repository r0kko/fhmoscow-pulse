import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Stadium extends Model {}

Stadium.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    city_id: { type: DataTypes.INTEGER },
    create_date: { type: DataTypes.DATE },
    update_date: { type: DataTypes.DATE },
    name: { type: DataTypes.STRING(255) },
    object_status: { type: DataTypes.STRING(255) },
    image_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'Stadium',
    tableName: 'stadium',
    timestamps: false,
  }
);

Stadium.associate = ({ City, ExtFile, Game, GameAssignment, Team }) => {
  Stadium.belongsTo(City, { foreignKey: 'city_id' });
  Stadium.belongsTo(ExtFile, { foreignKey: 'image_id' });
  if (Game) Stadium.hasMany(Game, { foreignKey: 'stadium_id' });
  if (GameAssignment)
    Stadium.hasMany(GameAssignment, { foreignKey: 'stadium_id' });
  if (Team) Stadium.hasMany(Team, { foreignKey: 'stadium_id' });
};

export default Stadium;
