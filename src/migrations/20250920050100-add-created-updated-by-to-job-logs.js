'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // created_by
    try {
      await queryInterface.addColumn('job_logs', 'created_by', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    } catch {
      /* noop: column may already exist */
    }

    // updated_by
    try {
      await queryInterface.addColumn('job_logs', 'updated_by', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    } catch {
      /* noop: column may already exist */
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeColumn('job_logs', 'updated_by');
    } catch {
      /* noop */
    }
    try {
      await queryInterface.removeColumn('job_logs', 'created_by');
    } catch {
      /* noop */
    }
  },
};
