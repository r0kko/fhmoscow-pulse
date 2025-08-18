'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('teams', 'full_name');
    await queryInterface.renameColumn('teams', 'short_name', 'name');
    await queryInterface.addColumn('teams', 'birth_year', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('teams', 'birth_year');
    await queryInterface.renameColumn('teams', 'name', 'short_name');
    await queryInterface.addColumn('teams', 'full_name', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });
  },
};
