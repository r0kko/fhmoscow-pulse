'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM medical_certificate_types WHERE alias IN ('CONCLUSION','RESULTS');"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'medical_certificate_types',
      [
        {
          id: uuidv4(),
          name: 'Заключение',
          alias: 'CONCLUSION',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Результаты исследований',
          alias: 'RESULTS',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('medical_certificate_types', {
      alias: ['CONCLUSION', 'RESULTS'],
    });
  },
};
