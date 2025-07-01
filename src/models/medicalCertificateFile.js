import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MedicalCertificateFile extends Model {}

MedicalCertificateFile.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    medical_certificate_id: { type: DataTypes.UUID, allowNull: false },
    file_id: { type: DataTypes.UUID, allowNull: false },
    type_id: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'MedicalCertificateFile',
    tableName: 'medical_certificate_files',
    paranoid: true,
    underscored: true,
  }
);

export default MedicalCertificateFile;
