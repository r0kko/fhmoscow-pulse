'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('match_players', 'squad_both', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addIndex('match_players', ['squad_both'], {
      name: 'match_players_squad_both_idx',
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex(
        'match_players',
        'match_players_squad_both_idx'
      );
    } catch {
      /* ignore */
    }
    await queryInterface.removeColumn('match_players', 'squad_both');
  },
};
