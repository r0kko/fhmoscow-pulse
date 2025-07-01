'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line quotes
      "SELECT COUNT(*) AS cnt FROM parking_types WHERE alias IN ('FREE','PAID','NONE');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'parking_types',
      [
        {
          id: uuidv4(),
          name: 'Бесплатная',
          alias: 'FREE',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Платная',
          alias: 'PAID',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Отсутствует',
          alias: 'NONE',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('parking_types', {
      alias: ['FREE', 'PAID', 'NONE'],
    });
  },
};
