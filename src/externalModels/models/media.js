import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Media extends Model {}

Media.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    type: { type: DataTypes.STRING(5) },
    object_status: { type: DataTypes.STRING(255) },
    date_publication: { type: DataTypes.DATE },
    show_in_slider: { type: DataTypes.BOOLEAN },
    tags: { type: DataTypes.TEXT('medium') },
  },
  {
    sequelize,
    modelName: 'Media',
    tableName: 'media',
    timestamps: false,
  }
);

export default Media;
