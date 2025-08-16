import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class BasicDocumentParentCategory extends Model {}

BasicDocumentParentCategory.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'BasicDocumentParentCategory',
    tableName: 'basic_document_parent_category',
    timestamps: false,
  }
);

BasicDocumentParentCategory.associate = ({ BasicDocument }) => {
  BasicDocumentParentCategory.hasMany(BasicDocument, { foreignKey: 'category_id' });
};

export default BasicDocumentParentCategory;
