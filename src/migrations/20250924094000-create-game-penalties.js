'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('game_penalties', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      external_id: { type: Sequelize.INTEGER, allowNull: false, unique: true },

      game_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'matches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      event_type_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'game_event_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      penalty_player_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'players', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      penalty_violation_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'game_violations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      minute: { type: Sequelize.INTEGER, allowNull: true },
      second: { type: Sequelize.INTEGER, allowNull: true },
      period: { type: Sequelize.INTEGER, allowNull: true },
      penalty_minutes_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'penalty_minutes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      team_penalty: { type: Sequelize.BOOLEAN, allowNull: true },

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

    await queryInterface.addIndex('game_penalties', ['game_id']);
    await queryInterface.addIndex('game_penalties', ['event_type_id']);
    await queryInterface.addIndex('game_penalties', ['penalty_player_id']);
    await queryInterface.addIndex('game_penalties', ['penalty_violation_id']);
    await queryInterface.addIndex('game_penalties', ['penalty_minutes_id']);
    await queryInterface.addIndex('game_penalties', [
      'game_id',
      'period',
      'minute',
      'second',
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('game_penalties');
  },
};
