import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class UserSignType extends Model {}

UserSignType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    sign_type_id: { type: DataTypes.UUID, allowNull: false },
    sign_created_date: { type: DataTypes.DATE },
  },
  {
    sequelize,
    modelName: 'UserSignType',
    tableName: 'user_sign_types',
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id'],
        where: { deleted_at: null },
        name: 'uq_user_sign_types_user_id_not_deleted',
      },
    ],
  }
);

export default UserSignType;
