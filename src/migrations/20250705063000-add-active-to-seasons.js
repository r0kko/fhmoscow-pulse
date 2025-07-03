'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('seasons', 'active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX seasons_active_true_idx ON seasons ((active)) WHERE active'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS seasons_active_true_idx'
    );
    await queryInterface.removeColumn('seasons', 'active');
  },
};
