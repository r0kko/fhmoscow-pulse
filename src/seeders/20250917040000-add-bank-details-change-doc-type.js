'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM document_types WHERE alias = 'BANK_DETAILS_CHANGE';"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'document_types',
      [
        {
          id: uuidv4(),
          name: 'Заявление об изменении банковских реквизитов',
          alias: 'BANK_DETAILS_CHANGE',
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
      alias: ['BANK_DETAILS_CHANGE'],
    });
  },
};
