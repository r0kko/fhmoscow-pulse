'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tours', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      external_id: { type: Sequelize.INTEGER, allowNull: false, unique: true },
      tournament_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'tournaments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      stage_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'stages', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      tournament_group_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'tournament_groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      name: { type: Sequelize.STRING(255) },
      date_start: { type: Sequelize.DATE },
      date_end: { type: Sequelize.DATE },
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

    await queryInterface.addIndex('tours', ['tournament_id']);
    await queryInterface.addIndex('tours', ['stage_id']);
    await queryInterface.addIndex('tours', ['tournament_group_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tours', ['tournament_group_id']);
    await queryInterface.removeIndex('tours', ['stage_id']);
    await queryInterface.removeIndex('tours', ['tournament_id']);
    await queryInterface.dropTable('tours');
  },
};
