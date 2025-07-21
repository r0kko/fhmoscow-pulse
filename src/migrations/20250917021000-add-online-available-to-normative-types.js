'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('normative_types', 'online_available', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.sequelize.query(
      'UPDATE normative_types SET online_available = FALSE WHERE online_available IS NULL'
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('normative_types', 'online_available');
  },
};
