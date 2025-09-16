'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM taxation_types WHERE alias IN ('IP_USN','IP_NPD','NPD','PERSON');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'taxation_types',
      [
        {
          id: randomUUID(),
          name: 'ИП (упрощенная система налогообложения)',
          alias: 'IP_USN',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'ИП (налог на профессиональный доход)',
          alias: 'IP_NPD',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Плательщик налога на профессиональный доход',
          alias: 'NPD',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Физическое лицо',
          alias: 'PERSON',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('taxation_types', {
      alias: ['IP_USN', 'IP_NPD', 'NPD', 'PERSON'],
    });
  },
};
