'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('clubs', 'is_moscow', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.sequelize.query(
      'UPDATE clubs SET is_moscow = FALSE WHERE is_moscow IS NULL'
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('clubs', 'is_moscow');
  },
};
