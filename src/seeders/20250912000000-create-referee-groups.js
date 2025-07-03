'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [season] = await queryInterface.sequelize.query(
      'SELECT id FROM seasons ORDER BY created_at LIMIT 1'
    );
    if (!season[0]) return;
    await queryInterface.bulkInsert(
      'referee_groups',
      [
        {
          id: uuidv4(),
          season_id: season[0].id,
          name: 'Основная группа',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('referee_groups', {
      name: ['Основная группа'],
    });
  },
};
