import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MedicalCenter extends Model {}

MedicalCenter.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    inn: { type: DataTypes.STRING(12), allowNull: false, unique: true },
    is_legal_entity: { type: DataTypes.BOOLEAN, allowNull: false },
    address_id: { type: DataTypes.UUID },
    phone: { type: DataTypes.STRING(15) },
    email: { type: DataTypes.STRING(255) },
    website: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'MedicalCenter',
    tableName: 'medical_centers',
    paranoid: true,
    underscored: true,
  }
);

export default MedicalCenter;
