import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class DoctrineMigrationVersions extends Model {}

DoctrineMigrationVersions.init(
  {
    version: { type: DataTypes.STRING(191), primaryKey: true },
  },
  {
    sequelize,
    modelName: 'DoctrineMigrationVersions',
    tableName: 'doctrine_migration_versions',
    timestamps: false,
  }
);

export default DoctrineMigrationVersions;
