'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [type] = await queryInterface.sequelize.query(
      `SELECT id FROM document_types WHERE alias = 'PDP_CONSENT' LIMIT 1;`
    );
    if (!type[0]) return;
    const [existing] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS cnt FROM documents WHERE alias = 'PDP_CONSENT';`
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'documents',
      [
        {
          id: uuidv4(),
          document_type_id: type[0].id,
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
    await queryInterface.bulkDelete('documents', { alias: 'PDP_CONSENT' });
  },
};
