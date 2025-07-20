'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('normative_results', 'zone_id', {
      type: Sequelize.UUID,
      references: { model: 'normative_zones', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('normative_results', 'zone_id');
  },
};
