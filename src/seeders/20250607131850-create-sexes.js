'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM sexes WHERE alias IN ('MALE','FEMALE');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'sexes',
      [
        {
          id: uuidv4(),
          name: 'Мужской',
          alias: 'MALE',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Женский',
          alias: 'FEMALE',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('sexes', { alias: ['MALE', 'FEMALE'] });
  },
};
