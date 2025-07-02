'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('trainings', 'camp_stadium_id', {
      type: Sequelize.UUID,
      references: { model: 'camp_stadiums', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('trainings', 'camp_stadium_id');
  },
};
