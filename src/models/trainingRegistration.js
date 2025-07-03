import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TrainingRegistration extends Model {}

TrainingRegistration.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: 'TrainingRegistration',
    tableName: 'training_registrations',
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['training_id', 'user_id'],
        where: { deleted_at: null },
      },
    ],
  }
);

export default TrainingRegistration;
