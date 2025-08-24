'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'club_players';
    const desc = await queryInterface.describeTable(table).catch(() => null);
    if (desc && !desc.number) {
      await queryInterface.addColumn(table, 'number', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('club_players', 'number').catch(() => {});
  },
};
