'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM ticket_types WHERE alias = 'MED_CERT_UPLOAD';"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'ticket_types',
      [
        {
          id: uuidv4(),
          name: 'Загрузка медицинской справки',
          alias: 'MED_CERT_UPLOAD',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('ticket_types', {
      alias: ['MED_CERT_UPLOAD'],
    });
  },
};
