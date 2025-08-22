'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('grounds', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      unique: true,
    });
    // Allow NULL without changing FK here (FK is adjusted in a dedicated migration)
    await queryInterface.changeColumn('grounds', 'address_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    // Create index with minimal locking for Postgres
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grounds_external_id ON grounds(external_id)'
      );
    } else {
      await queryInterface.addIndex('grounds', ['external_id']);
    }
  },

  async down(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS idx_grounds_external_id'
      );
    } else {
      await queryInterface.removeIndex('grounds', ['external_id']);
    }
    await queryInterface.removeColumn('grounds', 'external_id');
    await queryInterface.changeColumn('grounds', 'address_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
  },
};
