'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const items = [
      { name: 'Свитер главного судьи', alias: 'MAIN_REFEREE_SWEATER' },
      { name: 'Свитер линейного судьи', alias: 'LINESMAN_SWEATER' },
    ];
    const rows = items.map((it) => ({
      id: uuidv4(),
      name: it.name,
      alias: it.alias,
      created_at: now,
      updated_at: now,
    }));
    await queryInterface.bulkInsert('equipment_types', rows, {
      ignoreDuplicates: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('equipment_types', {
      alias: ['MAIN_REFEREE_SWEATER', 'LINESMAN_SWEATER'],
    });
  },
};
