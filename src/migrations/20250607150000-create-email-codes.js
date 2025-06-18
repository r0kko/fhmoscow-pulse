'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('email_codes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      code: { type: Sequelize.STRING(6), allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      deleted_at: { type: Sequelize.DATE },
    });
    await queryInterface.addIndex('email_codes', ['user_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('email_codes');
  },
};
