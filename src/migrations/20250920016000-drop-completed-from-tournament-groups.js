'use strict';

module.exports = {
  async up(queryInterface) {
    const desc = await queryInterface
      .describeTable('tournament_groups')
      .catch(() => null);
    if (desc && desc.completed) {
      await queryInterface.removeColumn('tournament_groups', 'completed');
    }
  },

  async down(queryInterface, Sequelize) {
    const desc = await queryInterface
      .describeTable('tournament_groups')
      .catch(() => null);
    if (desc && !desc.completed) {
      await queryInterface.addColumn('tournament_groups', 'completed', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      });
    }
  },
};
