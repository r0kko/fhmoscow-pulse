'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('matches', 'technical_winner', {
      type: Sequelize.STRING(10),
      allowNull: true,
    });
    await queryInterface.addIndex('matches', ['technical_winner']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('matches', ['technical_winner']);
    await queryInterface.removeColumn('matches', 'technical_winner');
  },
};
