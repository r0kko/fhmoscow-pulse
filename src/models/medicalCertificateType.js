import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MedicalCertificateType extends Model {}

MedicalCertificateType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'MedicalCertificateType',
    tableName: 'medical_certificate_types',
    paranoid: true,
    underscored: true,
  }
);

export default MedicalCertificateType;
