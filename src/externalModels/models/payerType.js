import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class PayerType extends Model {}

PayerType.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'PayerType',
    tableName: 'payer_type',
    timestamps: false,
  }
);

PayerType.associate = ({ RefereeTaxation }) => {
  if (RefereeTaxation)
    PayerType.hasMany(RefereeTaxation, { foreignKey: 'payer_type_id' });
};

export default PayerType;
