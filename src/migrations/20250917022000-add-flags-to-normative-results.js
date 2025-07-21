'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('normative_results', 'online', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('normative_results', 'retake', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.sequelize.query(
      'UPDATE normative_results SET online = FALSE, retake = FALSE WHERE online IS NULL OR retake IS NULL'
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('normative_results', 'retake');
    await queryInterface.removeColumn('normative_results', 'online');
  },
};
