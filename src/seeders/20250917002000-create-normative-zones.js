'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [seasonRes] = await queryInterface.sequelize.query(
      'SELECT id FROM seasons WHERE active = true LIMIT 1'
    );
    if (!seasonRes.length) return;
    const seasonId = seasonRes[0].id;
    const [existing] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS cnt FROM normative_zones;'
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'normative_zones',
      [
        {
          id: uuidv4(),
          season_id: seasonId,
          name: 'Зеленая',
          alias: 'GREEN',
          color: 'green',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          season_id: seasonId,
          name: 'Желтая',
          alias: 'YELLOW',
          color: 'yellow',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          season_id: seasonId,
          name: 'Красная',
          alias: 'RED',
          color: 'red',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('normative_zones', {
      alias: ['GREEN', 'YELLOW', 'RED'],
    });
  },
};
