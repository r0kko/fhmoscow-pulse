'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Enable extension
    await queryInterface.sequelize.query(
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
    );

    // Create table
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      last_name: { type: Sequelize.STRING(100), allowNull: false },
      first_name: { type: Sequelize.STRING(100), allowNull: false },
      patronymic: { type: Sequelize.STRING(100) },
      birth_date: { type: Sequelize.DATEONLY, allowNull: false },
      phone: { type: Sequelize.STRING(15), unique: true, allowNull: false },
      email: { type: Sequelize.STRING(255), unique: true, allowNull: false },

      created_by: {
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

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
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('users');
  },
};
