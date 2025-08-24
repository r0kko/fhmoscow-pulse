'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'team_players';
    const desc = await queryInterface.describeTable(table).catch(() => null);
    if (desc && !desc.season_id) {
      await queryInterface.addColumn(table, 'season_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'seasons', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex(table, ['season_id']);
    }
  },

  async down(queryInterface) {
    await queryInterface
      .removeIndex('team_players', ['season_id'])
      .catch(() => {});
    await queryInterface
      .removeColumn('team_players', 'season_id')
      .catch(() => {});
  },
};
