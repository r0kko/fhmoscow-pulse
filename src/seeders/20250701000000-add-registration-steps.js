'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM user_statuses WHERE alias IN ('REGISTRATION_STEP_1','REGISTRATION_STEP_2');"
    );
    if (Number(existing[0].cnt) > 0) return;
    const now = new Date();
    await queryInterface.bulkInsert(
      'user_statuses',
      [
        {
          id: uuidv4(),
          name: 'Registration step 1',
          alias: 'REGISTRATION_STEP_1',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Registration step 2',
          alias: 'REGISTRATION_STEP_2',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('user_statuses', {
      alias: ['REGISTRATION_STEP_1', 'REGISTRATION_STEP_2'],
    });
  },
};
