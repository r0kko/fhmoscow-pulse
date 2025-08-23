'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tournaments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      external_id: { type: Sequelize.INTEGER, allowNull: false, unique: true },
      season_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'seasons', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      type_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'tournament_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      name: { type: Sequelize.STRING(255), allowNull: false },
      full_name: { type: Sequelize.STRING(255) },
      birth_year: { type: Sequelize.INTEGER },
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

    await queryInterface.addIndex('tournaments', ['season_id']);
    await queryInterface.addIndex('tournaments', ['type_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tournaments', ['type_id']);
    await queryInterface.removeIndex('tournaments', ['season_id']);
    await queryInterface.dropTable('tournaments');
  },
};
