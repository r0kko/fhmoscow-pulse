'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('matches', 'scheduled_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('matches', 'game_status_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'game_statuses', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('matches', ['scheduled_date']);
    await queryInterface.addIndex('matches', ['game_status_id']);

    // Backfill scheduled_date from current date_start (Moscow date-only) where possible
    // This uses UTC shifting of +3h to get Moscow date; then format YYYY-MM-DD.
    await queryInterface.sequelize.query(`
      UPDATE matches
      SET scheduled_date = to_char((date_start AT TIME ZONE 'UTC' + INTERVAL '3 hour')::date, 'YYYY-MM-DD')::date
      WHERE scheduled_date IS NULL AND date_start IS NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('matches', ['game_status_id']);
    await queryInterface.removeIndex('matches', ['scheduled_date']);
    await queryInterface.removeColumn('matches', 'game_status_id');
    await queryInterface.removeColumn('matches', 'scheduled_date');
  },
};
