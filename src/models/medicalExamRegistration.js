import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MedicalExamRegistration extends Model {}

MedicalExamRegistration.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    approved: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    modelName: 'MedicalExamRegistration',
    tableName: 'medical_exam_registrations',
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['medical_exam_id', 'user_id'],
        where: { deleted_at: null },
      },
    ],
  }
);

export default MedicalExamRegistration;
