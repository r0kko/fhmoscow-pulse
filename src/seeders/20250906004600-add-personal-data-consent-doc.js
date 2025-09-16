'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM document_types WHERE alias = 'PERSONAL_DATA_CONSENT';"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'document_types',
      [
        {
          id: randomUUID(),
          name: 'Согласие на обработку персональных данных',
          alias: 'PERSONAL_DATA_CONSENT',
          generated: true,
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('document_types', {
      alias: ['PERSONAL_DATA_CONSENT'],
    });
  },
};
