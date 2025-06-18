'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'email_confirmed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'email_confirmed');
  },
};
