import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Equipment extends Model {}

Equipment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type_id: { type: DataTypes.UUID, allowNull: false },
    manufacturer_id: { type: DataTypes.UUID, allowNull: false },
    size_id: { type: DataTypes.UUID, allowNull: false },
    number: { type: DataTypes.INTEGER, allowNull: false },
    owner_id: { type: DataTypes.UUID, allowNull: true },
    assignment_document_id: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Equipment',
    tableName: 'equipment',
    paranoid: true,
    underscored: true,
  }
);

export default Equipment;
