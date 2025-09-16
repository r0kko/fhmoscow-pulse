'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM normative_value_types WHERE alias IN ('MORE_BETTER','LESS_BETTER');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'normative_value_types',
      [
        {
          id: randomUUID(),
          name: 'Больше лучше',
          alias: 'MORE_BETTER',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Меньше лучше',
          alias: 'LESS_BETTER',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('normative_value_types', {
      alias: ['MORE_BETTER', 'LESS_BETTER'],
    });
  },
};
