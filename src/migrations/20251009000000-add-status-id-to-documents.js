'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('documents');
    if (!table.status_id) {
      await queryInterface.addColumn('documents', 'status_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'document_statuses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      });
      const [rows] = await queryInterface.sequelize.query(
        "SELECT id FROM document_statuses WHERE alias = 'CREATED' LIMIT 1;"
      );
      if (rows[0]) {
        await queryInterface.sequelize.query(
          `UPDATE documents SET status_id = '${rows[0].id}' WHERE status_id IS NULL;`
        );
      }
      await queryInterface.changeColumn('documents', 'status_id', {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'document_statuses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('documents');
    if (table.status_id) {
      await queryInterface.removeColumn('documents', 'status_id');
    }
  },
};
