'use strict';

const { v4: uuidv4 } = require('uuid');

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
        id: uuidv4(),
        name: 'Ожидает решения',
        alias: 'PENDING',
        created_at: now,
        updated_at: now,
      });
    if (!existing.has('ACCEPTED'))
      items.push({
        id: uuidv4(),
        name: 'Согласовано',
        alias: 'ACCEPTED',
        created_at: now,
        updated_at: now,
      });
    if (!existing.has('DECLINED'))
      items.push({
        id: uuidv4(),
        name: 'Отклонено',
        alias: 'DECLINED',
        created_at: now,
        updated_at: now,
      });
    if (!existing.has('SUPERSEDED'))
      items.push({
        id: uuidv4(),
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
