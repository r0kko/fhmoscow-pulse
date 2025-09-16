'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const aliases = ['PENDING', 'ACCEPTED', 'DECLINED', 'SUPERSEDED'];
    // Skip if already seeded
    const [rows] = await queryInterface.sequelize.query(
      'SELECT alias FROM match_agreement_statuses WHERE alias IN (:aliases)',
      { replacements: { aliases } }
    );
    const existing = new Set(rows.map((r) => r.alias));
    const items = [];
    if (!existing.has('PENDING'))
      items.push({
        id: randomUUID(),
        name: 'Ожидает решения',
        alias: 'PENDING',
        created_at: now,
        updated_at: now,
      });
    if (!existing.has('ACCEPTED'))
      items.push({
        id: randomUUID(),
        name: 'Согласовано',
        alias: 'ACCEPTED',
        created_at: now,
        updated_at: now,
      });
    if (!existing.has('DECLINED'))
      items.push({
        id: randomUUID(),
        name: 'Отклонено',
        alias: 'DECLINED',
        created_at: now,
        updated_at: now,
      });
    if (!existing.has('SUPERSEDED'))
      items.push({
        id: randomUUID(),
        name: 'Заменено',
        alias: 'SUPERSEDED',
        created_at: now,
        updated_at: now,
      });
    if (items.length) {
      await queryInterface.bulkInsert('match_agreement_statuses', items, {
        ignoreDuplicates: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('match_agreement_statuses', {
      alias: ['PENDING', 'ACCEPTED', 'DECLINED', 'SUPERSEDED'],
    });
  },
};
