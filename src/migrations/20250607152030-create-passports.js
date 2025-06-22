'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('passports', {
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
        unique: true,
      },
      document_type_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'document_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      country_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'countries', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      series: { type: Sequelize.STRING(20) },
      number: { type: Sequelize.STRING(20) },
      issue_date: { type: Sequelize.DATEONLY },
      valid_until: { type: Sequelize.DATEONLY },
      issuing_authority: { type: Sequelize.STRING(255) },
      issuing_authority_code: { type: Sequelize.STRING(20) },
      place_of_birth: { type: Sequelize.STRING(255) },
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
    await queryInterface.dropTable('passports');
  },
};
