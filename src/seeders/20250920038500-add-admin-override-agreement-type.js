'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const alias = 'ADMIN_OVERRIDE';
    const [rows] = await queryInterface.sequelize.query(
      'SELECT id FROM match_agreement_types WHERE alias = :alias LIMIT 1',
      { replacements: { alias } }
    );
    if (rows && rows.length) return;
    await queryInterface.bulkInsert(
      'match_agreement_types',
      [
        {
          id: randomUUID(),
          name: 'Назначение администратором',
          alias,
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('match_agreement_types', {
      alias: 'ADMIN_OVERRIDE',
    });
  },
};
