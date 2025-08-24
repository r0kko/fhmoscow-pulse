'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('matches', 'season_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'seasons', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('matches', ['season_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('matches', ['season_id']);
    await queryInterface.removeColumn('matches', 'season_id');
  },
};
