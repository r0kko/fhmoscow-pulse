import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class TeamStaff extends Model {}

TeamStaff.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    staff_id: { type: DataTypes.INTEGER },
    team_id: { type: DataTypes.INTEGER },
    contract_id: { type: DataTypes.INTEGER },
    object_status: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'TeamStaff',
    tableName: 'team_staff',
    timestamps: false,
  }
);

TeamStaff.associate = ({ ClubStaff, Staff, Team }) => {
  TeamStaff.belongsTo(ClubStaff, { foreignKey: 'contract_id' });
  TeamStaff.belongsTo(Staff, { foreignKey: 'staff_id' });
  TeamStaff.belongsTo(Team, { foreignKey: 'team_id' });
};

export default TeamStaff;
