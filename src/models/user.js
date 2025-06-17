import { DataTypes, Model } from 'sequelize';
import bcrypt from 'bcryptjs';

import sequelize from '../config/database.js';

class User extends Model {
  async validPassword(plain) {
    return bcrypt.compare(plain, this.password);
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    last_name: { type: DataTypes.STRING(100), allowNull: false },
    first_name: { type: DataTypes.STRING(100), allowNull: false },
    patronymic: { type: DataTypes.STRING(100) },
    birth_date: { type: DataTypes.DATEONLY, allowNull: false },
    phone: {
      type: DataTypes.STRING(15),
      allowNull: false,
      unique: true,
      validate: { isNumeric: true },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING(255), // хранит bcrypt-hash!
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    paranoid: true,
    underscored: true,
    defaultScope: { attributes: { exclude: ['password'] } },
    scopes: {
      withPassword: { attributes: {} },
    },
    hooks: {
      beforeCreate: async (user) => {
        user.password = await bcrypt.hash(user.password, 10);
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
    },
  }
);

export default User;
