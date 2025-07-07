import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class MedicalExamRegistrationStatus extends Model {}

MedicalExamRegistrationStatus.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'MedicalExamRegistrationStatus',
    tableName: 'medical_exam_registration_statuses',
    paranoid: true,
    underscored: true,
  }
);

export default MedicalExamRegistrationStatus;
