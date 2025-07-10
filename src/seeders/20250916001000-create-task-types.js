'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
        // eslint-disable-next-line
      "SELECT COUNT(*) AS cnt FROM task_types WHERE alias = 'SELF_EMPLOYMENT_REGISTRATION';"
    );
    if (Number(existing[0].cnt) > 0) return;
    await queryInterface.bulkInsert(
      'task_types',
      [
        {
          id: uuidv4(),
          name: 'Зарегистрироваться как самозанятый или ИП',
          alias: 'SELF_EMPLOYMENT_REGISTRATION',
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('task_types', {
      alias: ['SELF_EMPLOYMENT_REGISTRATION'],
    });
  },
};
