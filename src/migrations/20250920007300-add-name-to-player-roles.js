'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface
      .describeTable('player_roles')
      .catch(() => null);
    if (desc && !desc.name) {
      await queryInterface.addColumn('player_roles', 'name', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('player_roles', 'name').catch(() => {});
  },
};
