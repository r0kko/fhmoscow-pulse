'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS cnt FROM document_statuses WHERE alias = 'ACTIVE';`
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'document_statuses',
      [
        {
          id: uuidv4(),
          name: 'Активен',
          alias: 'ACTIVE',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('document_statuses', { alias: 'ACTIVE' });
  },
};
