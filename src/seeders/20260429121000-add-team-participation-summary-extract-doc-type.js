'use strict';

const { randomUUID } = require('crypto');

const ALIAS = 'TEAM_PARTICIPATION_SUMMARY_EXTRACT';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM document_types WHERE alias = :alias LIMIT 1',
      { replacements: { alias: ALIAS } }
    );
    if (existing.length) return;

    await queryInterface.bulkInsert('document_types', [
      {
        id: randomUUID(),
        name: 'Выписка из протокола',
        alias: ALIAS,
        generated: false,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('document_types', { alias: ALIAS });
  },
};
