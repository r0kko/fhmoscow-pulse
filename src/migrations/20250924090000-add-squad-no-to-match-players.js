'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('match_players', 'squad_no', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addIndex('match_players', ['squad_no']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('match_players', ['squad_no']);
    await queryInterface.removeColumn('match_players', 'squad_no');
  },
};
