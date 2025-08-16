import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Log extends Model {}

Log.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    user_id: { type: DataTypes.INTEGER },
    datetime: { type: DataTypes.DATE },
    entity: { type: DataTypes.STRING(255) },
    action: { type: DataTypes.STRING(255) },
    object_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'ExtLog',
    tableName: 'log',
    timestamps: false,
  }
);

Log.associate = ({ User }) => {
  Log.belongsTo(User, { foreignKey: 'user_id' });
  if (User?.hasMany) User.hasMany(Log, { foreignKey: 'user_id' });
};

export default Log;
