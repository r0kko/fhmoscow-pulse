'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('match_participant_players', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      external_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
      },
      match_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'matches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      team_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'teams', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      player_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'players', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      role_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'player_roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      external_game_id: { type: Sequelize.INTEGER, allowNull: false },
      external_team_id: { type: Sequelize.INTEGER, allowNull: true },
      external_player_id: { type: Sequelize.INTEGER, allowNull: true },
      role_external_id: { type: Sequelize.INTEGER, allowNull: true },
      role_name: { type: Sequelize.STRING(255), allowNull: true },
      role_abbreviation: { type: Sequelize.STRING(64), allowNull: true },
      match_position_external_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      match_position_name: { type: Sequelize.STRING(255), allowNull: true },
      match_position_abbreviation: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      number: { type: Sequelize.INTEGER, allowNull: true },
      lineup_number: { type: Sequelize.INTEGER, allowNull: true },
      played: { type: Sequelize.BOOLEAN, allowNull: true },
      played_in_lineup: { type: Sequelize.INTEGER, allowNull: true },
      team_side: { type: Sequelize.INTEGER, allowNull: true },
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

    await queryInterface.addIndex('match_participant_players', ['match_id']);
    await queryInterface.addIndex('match_participant_players', ['team_id']);
    await queryInterface.addIndex('match_participant_players', ['player_id']);
    await queryInterface.addIndex('match_participant_players', ['role_id']);
    await queryInterface.addIndex('match_participant_players', [
      'external_game_id',
    ]);
    await queryInterface.addIndex('match_participant_players', [
      'external_team_id',
    ]);
    await queryInterface.addIndex('match_participant_players', [
      'external_player_id',
    ]);
    await queryInterface.addIndex('match_participant_players', ['team_side']);

    await queryInterface.createTable('match_participant_staff', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      external_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
      },
      match_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'matches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      team_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'teams', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      staff_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'staff', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      external_game_id: { type: Sequelize.INTEGER, allowNull: false },
      external_team_id: { type: Sequelize.INTEGER, allowNull: true },
      external_staff_id: { type: Sequelize.INTEGER, allowNull: true },
      position: { type: Sequelize.STRING(255), allowNull: true },
      team_side: { type: Sequelize.INTEGER, allowNull: true },
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

    await queryInterface.addIndex('match_participant_staff', ['match_id']);
    await queryInterface.addIndex('match_participant_staff', ['team_id']);
    await queryInterface.addIndex('match_participant_staff', ['staff_id']);
    await queryInterface.addIndex('match_participant_staff', [
      'external_game_id',
    ]);
    await queryInterface.addIndex('match_participant_staff', [
      'external_team_id',
    ]);
    await queryInterface.addIndex('match_participant_staff', [
      'external_staff_id',
    ]);
    await queryInterface.addIndex('match_participant_staff', ['team_side']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('match_participant_staff');
    await queryInterface.dropTable('match_participant_players');
  },
};
