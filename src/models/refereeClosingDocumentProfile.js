import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class RefereeClosingDocumentProfile extends Model {}

RefereeClosingDocumentProfile.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tournament_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    organizer_inn: { type: DataTypes.STRING(12), allowNull: true },
    organizer_name: { type: DataTypes.STRING(255), allowNull: true },
    organizer_short_name: { type: DataTypes.STRING(255), allowNull: true },
    organizer_kpp: { type: DataTypes.STRING(9), allowNull: true },
    organizer_ogrn: { type: DataTypes.STRING(15), allowNull: true },
    organizer_address: { type: DataTypes.STRING(500), allowNull: true },
    organizer_json: { type: DataTypes.JSONB, allowNull: true },
    dadata_payload: { type: DataTypes.JSONB, allowNull: true },
    last_verified_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'RefereeClosingDocumentProfile',
    tableName: 'referee_closing_document_profiles',
    paranoid: true,
    underscored: true,
  }
);

export default RefereeClosingDocumentProfile;
