'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn('game_penalties', 'external_fp', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
      await queryInterface.addIndex('game_penalties', ['external_id']);
    } catch (_e) {
      // Idempotency: if the column/index already exists, ignore
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('game_penalties', ['external_id']);
    } catch (_e) {
      /* ignore */
    }
    try {
      await queryInterface.removeColumn('game_penalties', 'external_fp');
    } catch (_e) {
      /* ignore */
    }
  },
};
