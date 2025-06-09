'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },

      /* Связь с пользователем (если авторизован) */
      user_id: {
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      /* Данные запроса / ответа */
      method: { type: Sequelize.STRING(10), allowNull: false },
      path: { type: Sequelize.STRING(2048), allowNull: false },
      status_code: { type: Sequelize.SMALLINT, allowNull: false },
      ip: { type: Sequelize.STRING(45) }, // IPv4 / IPv6
      user_agent: { type: Sequelize.STRING(512) },
      response_time: { type: Sequelize.INTEGER }, // мс
      request_body: { type: Sequelize.JSONB, allowNull: true },
      response_body: { type: Sequelize.JSONB, allowNull: true },

      /* Audit (кто создал лог) */
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    /* Индекс для быстрых выборок по пользователю и дате */
    await queryInterface.addIndex('logs', ['user_id', 'created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('logs');
  },
};
