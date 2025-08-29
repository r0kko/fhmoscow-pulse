'use strict';

module.exports = {
  async up(queryInterface) {
    // Drop legacy comment column from match_agreements
    const table = 'match_agreements';
    const column = 'comment';
    const qi = queryInterface;
    // Guard: only drop if exists
    if (typeof qi.describeTable === 'function') {
      const desc = await qi.describeTable(table);
      if (desc[column]) {
        await qi.removeColumn(table, column);
      }
      return;
    }
    await qi.removeColumn(table, column);
  },

  async down(queryInterface, Sequelize) {
    const table = 'match_agreements';
    await queryInterface.addColumn(table, 'comment', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },
};
