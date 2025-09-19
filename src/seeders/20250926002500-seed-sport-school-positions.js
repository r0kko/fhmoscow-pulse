'use strict';

const { randomUUID } = require('crypto');

const POSITIONS = [
  { alias: 'DIRECTOR', name: 'Директор' },
  { alias: 'METHODIST', name: 'Методист' },
  { alias: 'COACH', name: 'Тренер' },
  { alias: 'ADMINISTRATOR', name: 'Администратор' },
  { alias: 'ACCOUNTANT', name: 'Бухгалтер' },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = POSITIONS.map((position) => ({
      id: randomUUID(),
      alias: position.alias,
      name: position.name,
      description: null,
      created_at: now,
      updated_at: now,
    }));

    await queryInterface.bulkInsert('sport_school_positions', rows, {
      ignoreDuplicates: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('sport_school_positions', {
      alias: POSITIONS.map((p) => p.alias),
    });
  },
};
