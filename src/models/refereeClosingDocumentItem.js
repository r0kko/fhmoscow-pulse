import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class RefereeClosingDocumentItem extends Model {}

RefereeClosingDocumentItem.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    closing_document_id: { type: DataTypes.UUID, allowNull: false },
    accrual_document_id: { type: DataTypes.UUID, allowNull: true },
    line_no: { type: DataTypes.INTEGER, allowNull: false },
    snapshot_json: { type: DataTypes.JSONB, allowNull: false },
  },
  {
    sequelize,
    modelName: 'RefereeClosingDocumentItem',
    tableName: 'referee_closing_document_items',
    paranoid: true,
    underscored: true,
  }
);

export default RefereeClosingDocumentItem;
