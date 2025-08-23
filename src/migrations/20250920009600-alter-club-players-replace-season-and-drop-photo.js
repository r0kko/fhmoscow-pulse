'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'club_players';
    const [desc] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`
    );
    const cols = new Set(desc.map((r) => r.column_name));
    if (cols.has('photo_external_id')) {
      await queryInterface.removeColumn(table, 'photo_external_id');
    }
    if (cols.has('season_external_id')) {
      await queryInterface.removeColumn(table, 'season_external_id');
    }
    if (!cols.has('season_id')) {
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

  async down(queryInterface, Sequelize) {
    await queryInterface
      .removeIndex('club_players', ['season_id'])
      .catch(() => {});
    await queryInterface.removeColumn('club_players', 'season_id');
    await queryInterface.addColumn('club_players', 'season_external_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('club_players', 'photo_external_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
};
