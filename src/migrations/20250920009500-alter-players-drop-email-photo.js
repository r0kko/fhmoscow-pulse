'use strict';

module.exports = {
  async up(queryInterface) {
    // drop columns if they exist (be tolerant across environments)
    const table = 'players';
    const [desc] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`
    );
    const cols = new Set(desc.map((r) => r.column_name));
    if (cols.has('email')) {
      await queryInterface.removeColumn(table, 'email');
    }
    if (cols.has('photo_external_id')) {
      await queryInterface.removeColumn(table, 'photo_external_id');
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('players', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('players', 'photo_external_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
};
