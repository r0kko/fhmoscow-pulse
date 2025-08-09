'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('documents', 'document_date', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('NOW()'),
    });
    // backfill existing records if needed
    await queryInterface.sequelize.query(
      'UPDATE documents SET document_date = created_at WHERE document_date IS NULL;'
    );
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('documents', 'document_date');
  },
};
