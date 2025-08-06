'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('trainings', 'ground_id', {
      type: Sequelize.UUID,
      references: { model: 'grounds', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('trainings', 'ground_id');
  },
};
