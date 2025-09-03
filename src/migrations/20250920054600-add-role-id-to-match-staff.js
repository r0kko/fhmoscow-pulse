'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('match_staff', 'role_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addIndex('match_staff', ['role_id']);
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('match_staff', ['role_id']);
    await queryInterface.removeColumn('match_staff', 'role_id');
  },
};
