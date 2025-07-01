'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS cnt FROM training_types WHERE alias IN (\'ICE\',\'BASIC_FIT\',\'THEORY\');'
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'training_types',
      [
        {
          id: uuidv4(),
          name: 'Ледовая подготовка',
          alias: 'ICE',
          default_capacity: 20,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Основы физической подготовки',
          alias: 'BASIC_FIT',
          default_capacity: 20,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          name: 'Теоретическая подготовка',
          alias: 'THEORY',
          default_capacity: 20,
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('training_types', {
      alias: ['ICE', 'BASIC_FIT', 'THEORY'],
    });
  },
};
