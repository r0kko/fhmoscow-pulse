import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class CampStadiumParkingType extends Model {}

CampStadiumParkingType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    price: { type: DataTypes.DECIMAL(10, 2) },
  },
  {
    sequelize,
    modelName: 'CampStadiumParkingType',
    tableName: 'camp_stadium_parking_types',
    paranoid: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['camp_stadium_id', 'parking_type_id'] }],
  }
);

export default CampStadiumParkingType;
