import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Referee extends Model {}

Referee.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    category_id: { type: DataTypes.INTEGER },
    photo_id: { type: DataTypes.INTEGER },
    sex_id: { type: DataTypes.INTEGER },
    qualification_id: { type: DataTypes.INTEGER },
    qualification_hockey_league_id: { type: DataTypes.INTEGER },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    email: { type: DataTypes.STRING(255) },
    object_status: { type: DataTypes.STRING(255) },
    employment: { type: DataTypes.STRING(255) },
    reason_for_refusal: { type: DataTypes.STRING(255) },
    surname: { type: DataTypes.STRING(255) },
    name: { type: DataTypes.STRING(255) },
    patronymic: { type: DataTypes.STRING(255) },
    date_of_birth: { type: DataTypes.DATE },
    assigned_date: { type: DataTypes.DATE },
    qualification_order: { type: DataTypes.STRING(100) },
    phone: { type: DataTypes.STRING(255) },
    phone_add: { type: DataTypes.STRING(255) },
    telegram: { type: DataTypes.STRING(255) },
    height: { type: DataTypes.INTEGER },
    weight: { type: DataTypes.INTEGER },
    sweater_number: { type: DataTypes.INTEGER },
    car: { type: DataTypes.STRING(255) },
    car_licence_plate: { type: DataTypes.STRING(255) },
    second_car: { type: DataTypes.STRING(255) },
    second_car_licence_plate: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'Referee',
    tableName: 'referee',
    timestamps: false,
  }
);

Referee.associate = ({ ExtFile, Photo, RefereeCategory, RefereeQualification, RefereeQualificationHockeyLeague, Sex }) => {
  Referee.belongsTo(ExtFile, { foreignKey: 'photo_id' });
  Referee.belongsTo(Photo, { foreignKey: 'photo_id' });
  Referee.belongsTo(RefereeCategory, { foreignKey: 'category_id' });
  Referee.belongsTo(RefereeQualification, { foreignKey: 'qualification_id' });
  Referee.belongsTo(RefereeQualificationHockeyLeague, { foreignKey: 'qualification_hockey_league_id' });
  Referee.belongsTo(Sex, { foreignKey: 'sex_id' });
};

export default Referee;
