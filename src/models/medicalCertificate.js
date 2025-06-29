import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MedicalCertificate extends Model {}

MedicalCertificate.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    inn: { type: DataTypes.STRING(12), allowNull: false },
    organization: { type: DataTypes.STRING(255), allowNull: false },
    certificate_number: { type: DataTypes.STRING(50), allowNull: false },
    issue_date: { type: DataTypes.DATEONLY, allowNull: false },
    valid_until: { type: DataTypes.DATEONLY, allowNull: false },
  },
  {
    sequelize,
    modelName: 'MedicalCertificate',
    tableName: 'medical_certificates',
    paranoid: true,
    underscored: true,
  }
);

export default MedicalCertificate;
