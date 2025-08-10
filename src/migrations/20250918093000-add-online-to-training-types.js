'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('training_types', 'online', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.sequelize.query(
      'UPDATE training_types SET online = FALSE WHERE online IS NULL'
    );
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('training_types', 'online');
  },
};
