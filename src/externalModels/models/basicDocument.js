import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class BasicDocument extends Model {}

BasicDocument.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    file_id: { type: DataTypes.INTEGER },
    category_id: { type: DataTypes.INTEGER },
    season_id: { type: DataTypes.INTEGER },
    tournament_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'BasicDocument',
    tableName: 'basic_document',
    timestamps: false,
  }
);

BasicDocument.associate = ({
  BasicDocumentParentCategory,
  ExtFile,
  Season,
  Tournament,
}) => {
  BasicDocument.belongsTo(BasicDocumentParentCategory, {
    foreignKey: 'category_id',
  });
  BasicDocument.belongsTo(ExtFile, { foreignKey: 'file_id' });
  BasicDocument.belongsTo(Season, { foreignKey: 'season_id' });
  BasicDocument.belongsTo(Tournament, { foreignKey: 'tournament_id' });
};

export default BasicDocument;
