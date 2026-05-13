'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('async_job_events');
    if (table.updated_by) return;
    await queryInterface.addColumn('async_job_events', 'updated_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('async_job_events');
    if (!table.updated_by) return;
    await queryInterface.removeColumn('async_job_events', 'updated_by');
  },
};
