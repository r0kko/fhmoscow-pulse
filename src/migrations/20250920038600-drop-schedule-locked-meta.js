'use strict';

module.exports = {
  async up(queryInterface) {
    const table = 'matches';
    try {
      await queryInterface.removeColumn(table, 'schedule_locked_by');
    } catch {
      /* noop */
    }
    try {
      await queryInterface.removeColumn(table, 'schedule_locked_at');
    } catch {
      /* noop */
    }
  },

  async down(queryInterface, Sequelize) {
    const table = 'matches';
    try {
      await queryInterface.addColumn(table, 'schedule_locked_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    } catch {
      /* noop */
    }
    try {
      await queryInterface.addColumn(table, 'schedule_locked_by', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      });
    } catch {
      /* noop */
    }
  },
};
