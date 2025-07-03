'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('medical_centers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      name: { type: Sequelize.STRING(255), allowNull: false },
      inn: { type: Sequelize.STRING(12), allowNull: false, unique: true },
      is_legal_entity: { type: Sequelize.BOOLEAN, allowNull: false },
      address_id: {
        type: Sequelize.UUID,
        references: { model: 'addresses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      phone: { type: Sequelize.STRING(15) },
      email: { type: Sequelize.STRING(255) },
      website: { type: Sequelize.STRING(255) },
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

  async down(queryInterface) {
    await queryInterface.dropTable('medical_centers');
  },
};
