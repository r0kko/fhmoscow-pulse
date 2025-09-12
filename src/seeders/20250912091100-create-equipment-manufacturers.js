'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = [
      {
        id: uuidv4(),
        name: 'ZEDO',
        alias: 'ZEDO',
        created_at: now,
        updated_at: now,
      },
    ];
    await queryInterface.bulkInsert('equipment_manufacturers', rows, {
      ignoreDuplicates: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('equipment_manufacturers', {
      alias: ['ZEDO'],
    });
  },
};
