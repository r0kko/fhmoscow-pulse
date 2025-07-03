'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('trainings', 'season_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'seasons', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('trainings', 'season_id');
  },
};
