'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      `SELECT COUNT(*) AS cnt FROM document_types WHERE alias IN ('CIVIL','FOREIGN','RESIDENCE_PERMIT');`
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'document_types',
      [
        {
          id: randomUUID(),
          name: 'Паспорт гражданина',
          alias: 'CIVIL',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Заграничный паспорт',
          alias: 'FOREIGN',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Вид на жительство',
          alias: 'RESIDENCE_PERMIT',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('document_types', {
      alias: ['CIVIL', 'FOREIGN', 'RESIDENCE_PERMIT'],
    });
  },
};
