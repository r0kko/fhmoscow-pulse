'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('training_roles', 'for_camp', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.sequelize.query(
      'UPDATE training_roles SET for_camp = true'
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('training_roles', 'for_camp');
  },
};
