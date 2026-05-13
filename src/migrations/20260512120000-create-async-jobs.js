'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('documents', 'file_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'files', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    await queryInterface.addColumn('referee_closing_documents', 'pdf_status', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'READY',
    });
    await queryInterface.addColumn(
      'referee_closing_documents',
      'pdf_error_code',
      {
        type: Sequelize.STRING(128),
        allowNull: true,
      }
    );
    await queryInterface.addColumn(
      'referee_closing_documents',
      'pdf_generated_at',
      {
        type: Sequelize.DATE,
        allowNull: true,
      }
    );

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_referee_closing_documents_active_draft_referee
      ON referee_closing_documents (tournament_id, referee_id)
      WHERE status = 'DRAFT' AND deleted_at IS NULL
    `);

    await queryInterface.createTable('async_jobs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      job_type: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      operation: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      queue: {
        type: Sequelize.STRING(64),
        allowNull: false,
        defaultValue: 'default',
      },
      scope_type: {
        type: Sequelize.STRING(64),
        allowNull: false,
        defaultValue: 'SYSTEM',
      },
      scope_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'QUEUED',
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      payload_json: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      selection_json: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      result_json: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      dedupe_key: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      idempotency_key: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      requested_by_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      total_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      processed_count: {
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
      error_code: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      locked_by: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      locked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lock_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      finished_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
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
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.createTable('async_job_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      job_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'async_jobs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      item_type: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      target_type: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      target_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      target_ref_json: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      payload_json: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      result_json: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
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
      max_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      next_attempt_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      locked_by: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      locked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lock_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      error_code: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      finished_at: {
        type: Sequelize.DATE,
        allowNull: true,
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
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.createTable('async_job_events', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      job_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'async_jobs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      item_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'async_job_items', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      event_type: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      meta_json: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
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
    });

    await queryInterface.addIndex(
      'async_jobs',
      ['queue', 'status', 'scheduled_at', 'priority'],
      { name: 'idx_async_jobs_queue_status_scheduled_priority' }
    );
    await queryInterface.addIndex(
      'async_jobs',
      ['scope_type', 'scope_id', 'status', 'created_at'],
      { name: 'idx_async_jobs_scope_status_created' }
    );
    await queryInterface.addIndex('async_jobs', ['job_type', 'operation'], {
      name: 'idx_async_jobs_type_operation',
    });
    await queryInterface.addIndex('async_jobs', ['idempotency_key'], {
      name: 'idx_async_jobs_idempotency_key',
    });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_async_jobs_active_dedupe
      ON async_jobs (dedupe_key)
      WHERE dedupe_key IS NOT NULL
        AND deleted_at IS NULL
        AND status IN ('QUEUED', 'RUNNING')
    `);
    await queryInterface.addIndex(
      'async_job_items',
      ['job_id', 'status', 'next_attempt_at'],
      { name: 'idx_async_job_items_job_status_next_attempt' }
    );
    await queryInterface.addIndex(
      'async_job_items',
      ['target_type', 'target_id'],
      { name: 'idx_async_job_items_target' }
    );
    await queryInterface.addIndex(
      'async_job_events',
      ['job_id', 'created_at'],
      {
        name: 'idx_async_job_events_job_created',
      }
    );
    await queryInterface.addIndex('async_job_events', ['item_id'], {
      name: 'idx_async_job_events_item',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('async_job_events');
    await queryInterface.dropTable('async_job_items');
    await queryInterface.dropTable('async_jobs');
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS uq_referee_closing_documents_active_draft_referee'
    );
    await queryInterface.removeColumn(
      'referee_closing_documents',
      'pdf_generated_at'
    );
    await queryInterface.removeColumn(
      'referee_closing_documents',
      'pdf_error_code'
    );
    await queryInterface.removeColumn(
      'referee_closing_documents',
      'pdf_status'
    );
    await queryInterface.changeColumn('documents', 'file_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'files', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },
};
