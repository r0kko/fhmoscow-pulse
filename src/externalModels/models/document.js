import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Document extends Model {}

Document.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    file_id: { type: DataTypes.INTEGER },
    player_id: { type: DataTypes.INTEGER },
    name: { type: DataTypes.STRING(255) },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'Document',
    tableName: 'document',
    timestamps: false,
  }
);

Document.associate = ({ ExtFile, Player }) => {
  Document.belongsTo(ExtFile, { foreignKey: 'file_id' });
  Document.belongsTo(Player, { foreignKey: 'player_id' });
};

export default Document;
