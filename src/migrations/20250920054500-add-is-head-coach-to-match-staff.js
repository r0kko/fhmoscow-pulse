'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('match_staff', 'is_head_coach', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addIndex('match_staff', ['is_head_coach']);
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('match_staff', ['is_head_coach']);
    await queryInterface.removeColumn('match_staff', 'is_head_coach');
  },
};
