'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const aliases = [
      'YOUTH',
      'AMATEUR',
      'STUDENT',
      'PRO',
      'COMMERCIAL',
    ];
    const [existing] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS cnt FROM competition_types WHERE alias IN (:aliases);',
      { replacements: { aliases } }
    );
    if (Number(existing[0].cnt) > 0) return;

    const items = [
      { alias: 'YOUTH', name: 'Детско-юношеские' },
      { alias: 'AMATEUR', name: 'Любительские' },
      { alias: 'STUDENT', name: 'Студенческие' },
      { alias: 'PRO', name: 'Профессиональные' },
      { alias: 'COMMERCIAL', name: 'Коммерческие' },
    ];

    await queryInterface.bulkInsert(
      'competition_types',
      items.map((item) => ({
        id: randomUUID(),
        alias: item.alias,
        name: item.name,
        created_at: now,
        updated_at: now,
      }))
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('competition_types', {
      alias: ['YOUTH', 'AMATEUR', 'STUDENT', 'PRO', 'COMMERCIAL'],
    });
  },
};
