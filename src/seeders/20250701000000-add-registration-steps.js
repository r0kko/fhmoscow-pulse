'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
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
        {
          id: uuidv4(),
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
