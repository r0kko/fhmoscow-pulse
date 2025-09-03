'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('match_players', 'number', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('match_players', 'role_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'player_roles', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('match_players', ['role_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('match_players', ['role_id']);
    await queryInterface.removeColumn('match_players', 'role_id');
    await queryInterface.removeColumn('match_players', 'number');
  },
};
