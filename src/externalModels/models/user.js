import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class User extends Model {}

User.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    email: { type: DataTypes.STRING(180) },
    roles: { type: DataTypes.TEXT('long') },
    password: { type: DataTypes.STRING(255) },
    date_create: { type: DataTypes.DATE },
    surname: { type: DataTypes.STRING(255) },
    name: { type: DataTypes.STRING(255) },
    patronymic: { type: DataTypes.STRING(255) },
    date_of_birth: { type: DataTypes.DATE },
    phone: { type: DataTypes.STRING(255) },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
    block_reason: { type: DataTypes.STRING(255) },
    referee_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'ExtUser',
    tableName: 'user',
    timestamps: false,
  }
);

User.associate = ({ Referee }) => {
  User.belongsTo(Referee, { foreignKey: 'referee_id' });
};

export default User;
