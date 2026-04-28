'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('match_protocol_export_jobs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      team_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'teams', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      season_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'seasons', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      requested_by_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      archive_file_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'files', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      fingerprint: { type: Sequelize.STRING(128), allowNull: false },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'QUEUED',
      },
      selected_player_ids: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      selected_external_player_ids: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      total_matches: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      processed_matches: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      success_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      skipped_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      failure_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      error_code: { type: Sequelize.STRING(128), allowNull: true },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      started_at: { type: Sequelize.DATE, allowNull: true },
      finished_at: { type: Sequelize.DATE, allowNull: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
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

    await queryInterface.createTable('match_protocol_export_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      job_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'match_protocol_export_jobs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      match_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'matches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      external_match_id: { type: Sequelize.INTEGER, allowNull: true },
      filename: { type: Sequelize.STRING(255), allowNull: true },
      highlighted_external_player_ids: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'QUEUED',
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      error_code: { type: Sequelize.STRING(128), allowNull: true },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      started_at: { type: Sequelize.DATE, allowNull: true },
      finished_at: { type: Sequelize.DATE, allowNull: true },
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

    await queryInterface.addIndex('match_protocol_export_jobs', [
      'team_id',
      'season_id',
    ]);
    await queryInterface.addIndex('match_protocol_export_jobs', [
      'requested_by_user_id',
    ]);
    await queryInterface.addIndex('match_protocol_export_jobs', ['status']);
    await queryInterface.addIndex('match_protocol_export_jobs', [
      'fingerprint',
    ]);
    await queryInterface.addIndex('match_protocol_export_jobs', ['expires_at']);
    await queryInterface.addIndex('match_protocol_export_items', ['job_id']);
    await queryInterface.addIndex('match_protocol_export_items', ['match_id']);
    await queryInterface.addIndex('match_protocol_export_items', ['status']);
    await queryInterface.addIndex('match_protocol_export_items', [
      'external_match_id',
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('match_protocol_export_items');
    await queryInterface.dropTable('match_protocol_export_jobs');
  },
};
