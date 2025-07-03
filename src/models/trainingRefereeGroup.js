import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TrainingRefereeGroup extends Model {}

TrainingRefereeGroup.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: 'TrainingRefereeGroup',
    tableName: 'training_referee_groups',
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['training_id', 'group_id'],
        where: { deleted_at: null },
      },
    ],
  }
);

export default TrainingRefereeGroup;
