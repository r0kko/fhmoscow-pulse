'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('vehicles', {
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
      brand: { type: Sequelize.STRING(50), allowNull: false },
      model: { type: Sequelize.STRING(50) },
      number: { type: Sequelize.STRING(12), allowNull: false },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
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
    await queryInterface.addIndex('vehicles', ['user_id'], {
      name: 'idx_vehicles_user_id',
    });
    await queryInterface.addIndex('vehicles', ['user_id'], {
      name: 'uq_vehicles_active_user',
      unique: true,
      where: { is_active: true, deleted_at: null },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('vehicles');
  },
};
