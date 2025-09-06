'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const [admin] = await queryInterface.sequelize.query(
      `SELECT id
             FROM users
             WHERE email = 'aadrobot@fhmoscow.com'
             LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    if (admin) return;

    // id статуса и роли
    const [status] = await queryInterface.sequelize.query(
      `SELECT id
             FROM user_statuses
             WHERE alias = 'ACTIVE'
             LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const [role] = await queryInterface.sequelize.query(
      `SELECT id
             FROM roles
             WHERE alias = 'ADMIN'
             LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const [sex] = await queryInterface.sequelize.query(
      `SELECT id
             FROM sexes
             WHERE alias = 'MALE'
             LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const userId = uuidv4();

    await queryInterface.bulkInsert('users', [
      {
        id: userId,
        last_name: 'Дробот',
        first_name: 'Алексей',
        patronymic: 'Андреевич',
        birth_date: '2003-06-23',
        phone: '79262442222',
        email: 'aadrobot@fhmoscow.com',
        password:
          '$2y$10$QRGlP7C.Ezw7Gbg3nLOAi..IV2UnRqy.DbGQ9TQ9v7IuM6xuK11Mi',
        status_id: status.id,
        sex_id: sex.id,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('user_roles', [
      {
        id: uuidv4(),
        user_id: userId,
        role_id: role.id,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'user_roles',
      {
        /* all */
      },
      {}
    );
    await queryInterface.bulkDelete(
      'users',
      { email: 'aadrobot@fhmoscow.com' },
      {}
    );
  },
};
