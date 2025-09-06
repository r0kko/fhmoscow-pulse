'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const aliases = ['CREATED', 'AWAITING_SIGNATURE', 'SIGNED', 'REJECTED'];
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      `SELECT COUNT(*) AS cnt FROM document_statuses WHERE alias IN ('${aliases.join("','")}');`
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'document_statuses',
      [
        {
          id: uuidv4(),
          name: 'Создан',
          alias: 'CREATED',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Ожидает подписания',
          alias: 'AWAITING_SIGNATURE',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Подписан',
          alias: 'SIGNED',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Отклонен',
          alias: 'REJECTED',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('document_statuses', {
      alias: ['CREATED', 'AWAITING_SIGNATURE', 'SIGNED', 'REJECTED'],
    });
  },
};
