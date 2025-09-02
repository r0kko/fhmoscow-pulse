'use strict';

module.exports = {
  /** @type {import('sequelize').Migration} */
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('match_agreements', 'decision_reminded_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addIndex('match_agreements', ['decision_reminded_at']);
  },

  /** @type {import('sequelize').Migration} */
  async down(queryInterface) {
    await queryInterface.removeIndex('match_agreements', [
      'decision_reminded_at',
    ]);
    await queryInterface.removeColumn(
      'match_agreements',
      'decision_reminded_at'
    );
  },
};
