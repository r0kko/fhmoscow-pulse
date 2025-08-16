import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class RefereeDocument extends Model {}

RefereeDocument.init(
  { id: { type: DataTypes.INTEGER, primaryKey: true }, referee_id: { type: DataTypes.INTEGER } },
  {
    sequelize,
    modelName: 'RefereeDocument',
    tableName: 'referee_document',
    timestamps: false,
  }
);

RefereeDocument.associate = ({ Referee }) => {
  RefereeDocument.belongsTo(Referee, { foreignKey: 'referee_id' });
};

export default RefereeDocument;
