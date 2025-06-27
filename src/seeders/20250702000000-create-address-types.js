'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      "SELECT COUNT(*) AS cnt FROM address_types WHERE alias IN ('REGISTRATION','RESIDENCE');"
    );
    if (Number(existing[0].cnt) > 0) return;
    const now = new Date();
    await queryInterface.bulkInsert(
      'address_types',
      [
        {
          id: uuidv4(),
          name: 'Адрес регистрации',
          alias: 'REGISTRATION',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Адрес проживания',
          alias: 'RESIDENCE',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('address_types', {
      alias: ['REGISTRATION', 'RESIDENCE'],
    });
  },
};
