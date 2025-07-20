'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('normative_zones', 'season_id');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('normative_zones', 'season_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'seasons', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },
};
