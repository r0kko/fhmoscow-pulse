'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      "SELECT COUNT(*) AS cnt FROM ticket_types WHERE alias = 'NORMATIVE_ONLINE';"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'ticket_types',
      [
        {
          id: uuidv4(),
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
