import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Passport extends Model {}

Passport.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    document_type_id: { type: DataTypes.UUID, allowNull: false },
    country_id: { type: DataTypes.UUID, allowNull: false },
    series: { type: DataTypes.STRING(20) },
    number: { type: DataTypes.STRING(20) },
    issue_date: { type: DataTypes.DATEONLY },
    valid_until: { type: DataTypes.DATEONLY },
    issuing_authority: { type: DataTypes.STRING(255) },
    issuing_authority_code: { type: DataTypes.STRING(20) },
    place_of_birth: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'Passport',
    tableName: 'passports',
    paranoid: true,
    underscored: true,
  }
);

export default Passport;
