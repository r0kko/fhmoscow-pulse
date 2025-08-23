'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'seasons';
    const [desc] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`
    );
    const cols = new Set(desc.map((r) => r.column_name));
    if (!cols.has('external_id')) {
      await queryInterface.addColumn(table, 'external_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        unique: true,
      });
      await queryInterface
        .addIndex(table, ['external_id'], {
          unique: true,
          where: { deleted_at: null },
          name: 'seasons_external_id_unique',
        })
        .catch(() => {});
    }
  },

  async down(queryInterface) {
    await queryInterface
      .removeIndex('seasons', 'seasons_external_id_unique')
      .catch(() => {});
    await queryInterface.removeColumn('seasons', 'external_id');
  },
};
