'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('job_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      job: { type: Sequelize.STRING(100), allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false }, // START, SUCCESS, ERROR, SKIPPED
      started_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      finished_at: { type: Sequelize.DATE, allowNull: true },
      duration_ms: { type: Sequelize.INTEGER, allowNull: true },
      message: { type: Sequelize.TEXT, allowNull: true },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
    await queryInterface.addIndex('job_logs', ['job']);
    await queryInterface.addIndex('job_logs', ['status']);
    await queryInterface.addIndex('job_logs', ['started_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('job_logs');
  },
};
