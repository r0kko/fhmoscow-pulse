'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const sizes = [46, 48, 50, 52, 54, 56, 58];
    const rows = sizes.map((s) => ({
      id: randomUUID(),
      name: String(s),
      alias: `SIZE_${s}`,
      created_at: now,
      updated_at: now,
    }));
    await queryInterface.bulkInsert('equipment_sizes', rows, {
      ignoreDuplicates: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('equipment_sizes', {
      alias: [
        'SIZE_46',
        'SIZE_48',
        'SIZE_50',
        'SIZE_52',
        'SIZE_54',
        'SIZE_56',
        'SIZE_58',
      ],
    });
  },
};
