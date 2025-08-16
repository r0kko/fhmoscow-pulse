import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class RefereeTaxation extends Model {}

RefereeTaxation.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    referee_id: { type: DataTypes.INTEGER },
    payer_type_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'RefereeTaxation',
    tableName: 'referee_taxation',
    timestamps: false,
  }
);

RefereeTaxation.associate = ({ PayerType, Referee }) => {
  RefereeTaxation.belongsTo(PayerType, { foreignKey: 'payer_type_id' });
  RefereeTaxation.belongsTo(Referee, { foreignKey: 'referee_id' });
};

export default RefereeTaxation;
