'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT id FROM document_types WHERE alias = 'EQUIPMENT_TRANSFER' LIMIT 1;"
    );
    if (existing && existing[0] && existing[0].id) return;
    await queryInterface.bulkInsert('document_types', [
      {
        id: randomUUID(),
        name: 'Акт передачи экипировки',
        alias: 'EQUIPMENT_TRANSFER',
        generated: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('document_types', {
      alias: ['EQUIPMENT_TRANSFER'],
    });
  },
};
