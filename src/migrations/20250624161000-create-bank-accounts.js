'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('bank_accounts', {
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
      number: { type: Sequelize.STRING(20), allowNull: false },
      bic: { type: Sequelize.STRING(9), allowNull: false },
      bank_name: { type: Sequelize.STRING(255) },
      correspondent_account: { type: Sequelize.STRING(20) },
      swift: { type: Sequelize.STRING(20) },
      inn: { type: Sequelize.STRING(12) },
      kpp: { type: Sequelize.STRING(9) },
      address: { type: Sequelize.STRING(255) },
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
    await queryInterface.addIndex('bank_accounts', ['user_id'], {
      name: 'uq_bank_accounts_user_id_not_deleted',
      unique: true,
      where: { deleted_at: null },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('bank_accounts');
  },
};
