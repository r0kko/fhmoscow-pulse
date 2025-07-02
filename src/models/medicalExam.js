import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class MedicalExam extends Model {}

MedicalExam.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    medical_center_id: { type: DataTypes.UUID, allowNull: false },
    status_id: { type: DataTypes.UUID, allowNull: false },
    start_at: { type: DataTypes.DATEONLY, allowNull: false },
    end_at: { type: DataTypes.DATEONLY, allowNull: false },
    capacity: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'MedicalExam',
    tableName: 'medical_exams',
    paranoid: true,
    underscored: true,
  }
);

export default MedicalExam;
