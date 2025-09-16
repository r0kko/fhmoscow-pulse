'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'user_statuses',
      [
        {
          id: randomUUID(),
          name: 'Registration step 1',
          alias: 'REGISTRATION_STEP_1',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Registration step 2',
          alias: 'REGISTRATION_STEP_2',
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Registration step 3',
          alias: 'REGISTRATION_STEP_3',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('user_statuses', {
      alias: [
        'REGISTRATION_STEP_1',
        'REGISTRATION_STEP_2',
        'REGISTRATION_STEP_3',
      ],
    });
  },
};
