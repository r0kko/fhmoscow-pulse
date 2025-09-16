'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM ticket_types WHERE alias = 'NORMATIVE_ONLINE';"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'ticket_types',
      [
        {
          id: randomUUID(),
          name: 'Сдача норматива онлайн',
          alias: 'NORMATIVE_ONLINE',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('ticket_types', {
      alias: ['NORMATIVE_ONLINE'],
    });
  },
};
