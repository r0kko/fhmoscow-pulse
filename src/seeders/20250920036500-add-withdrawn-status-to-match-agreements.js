'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [rows] = await queryInterface.sequelize.query(
      'SELECT id FROM match_agreement_statuses WHERE alias = \'WITHDRAWN\''
    );
    if (rows && rows.length) return;
    await queryInterface.bulkInsert(
      'match_agreement_statuses',
      [
        {
          id: uuidv4(),
          name: 'Отозвано',
          alias: 'WITHDRAWN',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('match_agreement_statuses', {
      alias: 'WITHDRAWN',
    });
  },
};
