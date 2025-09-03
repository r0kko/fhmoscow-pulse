'use strict';

module.exports = {
  async up(queryInterface) {
    // Drop index if exists, then column (safe for multiple runs)
    try {
      await queryInterface.removeIndex('match_staff', ['is_head_coach']);
    } catch {
      // ignore if index doesn't exist
    }
    try {
      await queryInterface.removeColumn('match_staff', 'is_head_coach');
    } catch {
      // ignore if column already removed
    }
  },
  async down(queryInterface, Sequelize) {
    // Recreate the column and index if rolling back
    try {
      await queryInterface.addColumn('match_staff', 'is_head_coach', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      await queryInterface.addIndex('match_staff', ['is_head_coach']);
    } catch {
      // ignore if already present
    }
  },
};
