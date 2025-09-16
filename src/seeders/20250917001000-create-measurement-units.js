'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS cnt FROM measurement_units;'
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'measurement_units',
      [
        {
          id: randomUUID(),
          name: 'Минуты и секунды',
          alias: 'MIN_SEC',
          fractional: false,
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Секунды',
          alias: 'SECONDS',
          fractional: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Повторения',
          alias: 'REPS',
          fractional: false,
          created_at: now,
          updated_at: now,
        },
        {
          id: randomUUID(),
          name: 'Отрезки',
          alias: 'SEGMENTS',
          fractional: false,
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('measurement_units', {
      alias: ['MIN_SEC', 'SECONDS', 'REPS', 'SEGMENTS'],
    });
  },
};
