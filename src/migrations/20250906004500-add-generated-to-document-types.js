'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('document_types', 'generated', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    // ensure existing rows get the default value
    await queryInterface.sequelize.query(
      'UPDATE document_types SET generated = FALSE WHERE generated IS NULL'
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('document_types', 'generated');
  },
};
