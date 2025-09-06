'use strict';

const { v4: uuidv4 } = require('uuid');

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
          id: uuidv4(),
          name: 'ИП (упрощенная система налогообложения)',
          alias: 'IP_USN',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'ИП (налог на профессиональный доход)',
          alias: 'IP_NPD',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Плательщик налога на профессиональный доход',
          alias: 'NPD',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
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
