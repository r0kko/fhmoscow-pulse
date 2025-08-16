import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class PageEditor extends Model {}

PageEditor.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    title: { type: DataTypes.STRING(255) },
    slug: { type: DataTypes.STRING(255) },
    html: { type: DataTypes.TEXT('long') },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'PageEditor',
    tableName: 'page_editor',
    timestamps: false,
  }
);

export default PageEditor;
