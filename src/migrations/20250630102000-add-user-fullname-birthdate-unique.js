'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [active] = await queryInterface.sequelize.query(
        // eslint-disable-next-line
        "SELECT id FROM user_statuses WHERE alias = 'ACTIVE' LIMIT 1;",
      { type: Sequelize.QueryTypes.SELECT }
    );
    await queryInterface.addIndex(
      'users',
      ['last_name', 'first_name', 'patronymic', 'birth_date'],
      {
        name: 'uq_users_fullname_birth_date_active',
        unique: true,
        where: {
          deleted_at: null,
          status_id: active.id,
        },
      }
    );
  },
  down: async (queryInterface, _Sequelize) => {
    await queryInterface.removeIndex(
      'users',
      'uq_users_fullname_birth_date_active'
    );
  },
};
