'use strict';

module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      'SELECT id FROM match_referee_statuses WHERE alias = :alias LIMIT 1',
      { replacements: { alias: 'CONFIRMED' } }
    );
    if (Array.isArray(rows) && rows.length) return;
    const now = new Date();
    await queryInterface.bulkInsert('match_referee_statuses', [
      {
        alias: 'CONFIRMED',
        name: 'Подтверждено',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    const [confirmedRows] = await queryInterface.sequelize.query(
      'SELECT id FROM match_referee_statuses WHERE alias = :alias LIMIT 1',
      { replacements: { alias: 'CONFIRMED' } }
    );
    if (!Array.isArray(confirmedRows) || !confirmedRows.length) return;
    const confirmedId = confirmedRows[0].id;
    const [publishedRows] = await queryInterface.sequelize.query(
      'SELECT id FROM match_referee_statuses WHERE alias = :alias LIMIT 1',
      { replacements: { alias: 'PUBLISHED' } }
    );
    if (Array.isArray(publishedRows) && publishedRows.length) {
      await queryInterface.sequelize.query(
        `
        UPDATE match_referees
        SET status_id = '${publishedRows[0].id}'
        WHERE status_id = '${confirmedId}'
        `
      );
    }
    await queryInterface.sequelize.query(
      'DELETE FROM match_referee_statuses WHERE id = :id',
      { replacements: { id: confirmedId } }
    );
  },
};
