'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('referee_groups', 'camp_stadium_id', {
      type: Sequelize.UUID,
      references: { model: 'camp_stadiums', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('referee_groups', 'camp_stadium_id');
  },
};
