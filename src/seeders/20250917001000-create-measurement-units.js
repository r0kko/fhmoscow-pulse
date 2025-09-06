'use strict';

const { v4: uuidv4 } = require('uuid');

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
          id: uuidv4(),
          name: 'Минуты и секунды',
          alias: 'MIN_SEC',
          fractional: false,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Секунды',
          alias: 'SECONDS',
          fractional: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Повторения',
          alias: 'REPS',
          fractional: false,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
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
