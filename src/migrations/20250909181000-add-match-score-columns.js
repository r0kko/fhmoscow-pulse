'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('matches', 'score_team1', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('matches', 'score_team2', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('matches', 'score_team2');
    await queryInterface.removeColumn('matches', 'score_team1');
  },
};
