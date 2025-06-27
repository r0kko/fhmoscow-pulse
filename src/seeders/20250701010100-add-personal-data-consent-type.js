'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS cnt FROM document_types WHERE alias = 'PDP_CONSENT';`
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'document_types',
      [
        {
          id: uuidv4(),
          name: 'Согласие на обработку персональных данных',
          alias: 'PDP_CONSENT',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('document_types', { alias: 'PDP_CONSENT' });
  },
};
