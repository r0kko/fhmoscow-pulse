'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('number_counters', {
      scope: {
        type: Sequelize.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      last_seq: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.createTable('match_protocol_snapshots', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      match_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'matches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      external_match_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      document_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      number: {
        type: Sequelize.STRING(32),
        allowNull: false,
        unique: true,
      },
      upstream_etag: {
        type: Sequelize.STRING(255),
      },
      upstream_last_modified: {
        type: Sequelize.DATE,
      },
      upstream_filename: {
        type: Sequelize.STRING(255),
      },
      signed_file_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'files', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      signed_by_user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      signed_role_alias: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      signed_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      render_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      seal_asset_hash: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      last_checked_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'ACTIVE',
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
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      deleted_at: {
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex(
      'match_protocol_snapshots',
      ['match_id', 'status', 'signed_at'],
      { name: 'idx_match_protocol_snapshots_match_status_signed' }
    );
    await queryInterface.addIndex(
      'match_protocol_snapshots',
      ['external_match_id', 'status'],
      { name: 'idx_match_protocol_snapshots_external_match_status' }
    );
    await queryInterface.addIndex('match_protocol_snapshots', ['match_id'], {
      name: 'uq_match_protocol_snapshots_match_active',
      unique: true,
      where: {
        status: 'ACTIVE',
        deleted_at: null,
      },
    });

    await queryInterface.sequelize.query(
      `INSERT INTO number_counters (
         scope,
         year,
         last_seq,
         created_at,
         updated_at
       )
       SELECT
         'DOCUMENT' AS scope,
         EXTRACT(YEAR FROM document_date)::INTEGER AS year,
         MAX(CAST(split_part(number, '/', 2) AS INTEGER)) AS last_seq,
         NOW(),
         NOW()
       FROM documents
       WHERE document_date IS NOT NULL
         AND number ~ '^[0-9]{2}\\.[0-9]{2}/[0-9]+$'
       GROUP BY EXTRACT(YEAR FROM document_date)::INTEGER
       ON CONFLICT (scope, year) DO UPDATE
       SET last_seq = GREATEST(number_counters.last_seq, EXCLUDED.last_seq),
           updated_at = NOW()`
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('match_protocol_snapshots');
    await queryInterface.dropTable('number_counters');
  },
};
