'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('teams', 'club_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'clubs', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('teams', ['club_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('teams', ['club_id']);
    await queryInterface.removeColumn('teams', 'club_id');
  },
};
