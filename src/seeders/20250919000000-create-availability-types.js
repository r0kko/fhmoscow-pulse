'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM availability_types WHERE alias IN ('FREE','PARTIAL','BUSY');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'availability_types',
      [
        {
          id: uuidv4(),
          name: 'Свободен',
          alias: 'FREE',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Частично занят',
          alias: 'PARTIAL',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Занят',
          alias: 'BUSY',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('availability_types', {
      alias: ['FREE', 'PARTIAL', 'BUSY'],
    });
  },
};
