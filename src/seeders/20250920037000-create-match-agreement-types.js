'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const aliases = [
      'HOME_PROPOSAL',
      'AWAY_APPROVAL',
      'AWAY_COUNTER',
      'HOME_APPROVAL',
    ];
    const [rows] = await queryInterface.sequelize.query(
      'SELECT alias FROM match_agreement_types WHERE alias IN (:aliases)',
      { replacements: { aliases } }
    );
    const existing = new Set(rows.map((r) => r.alias));
    const items = [];
    if (!existing.has('HOME_PROPOSAL'))
      items.push({
        id: randomUUID(),
        name: 'Предложение команды-хозяина',
        alias: 'HOME_PROPOSAL',
        created_at: now,
        updated_at: now,
      });
    if (!existing.has('AWAY_APPROVAL'))
      items.push({
        id: randomUUID(),
        name: 'Согласование командой-гостем',
        alias: 'AWAY_APPROVAL',
        created_at: now,
        updated_at: now,
      });
    if (!existing.has('AWAY_COUNTER'))
      items.push({
        id: randomUUID(),
        name: 'Встречное предложение команды-гостя',
        alias: 'AWAY_COUNTER',
        created_at: now,
        updated_at: now,
      });
    if (!existing.has('HOME_APPROVAL'))
      items.push({
        id: randomUUID(),
        name: 'Согласование командой хозяев',
        alias: 'HOME_APPROVAL',
        created_at: now,
        updated_at: now,
      });
    if (items.length) {
      await queryInterface.bulkInsert('match_agreement_types', items, {
        ignoreDuplicates: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('match_agreement_types', {
      alias: [
        'HOME_PROPOSAL',
        'AWAY_APPROVAL',
        'AWAY_COUNTER',
        'HOME_APPROVAL',
      ],
    });
  },
};
