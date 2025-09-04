'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('match_staff', 'squad_no', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addIndex('match_staff', ['squad_no']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('match_staff', ['squad_no']);
    await queryInterface.removeColumn('match_staff', 'squad_no');
  },
};
