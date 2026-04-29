'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('number_counters', 'month', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.sequelize.query(
      'ALTER TABLE number_counters DROP CONSTRAINT IF EXISTS number_counters_pkey'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE number_counters ADD PRIMARY KEY (scope, year, month)'
    );
    await queryInterface.sequelize.query('DELETE FROM number_counters');
    await queryInterface.sequelize.query(
      `INSERT INTO number_counters (
         scope,
         year,
         month,
         last_seq,
         created_at,
         updated_at
       )
       SELECT
         'DOCUMENT' AS scope,
         year,
         month,
         MAX(seq) AS last_seq,
         NOW(),
         NOW()
       FROM (
         SELECT
           EXTRACT(YEAR FROM document_date)::INTEGER AS year,
           EXTRACT(MONTH FROM document_date)::INTEGER AS month,
           CAST(split_part(number, '/', 2) AS INTEGER) AS seq
         FROM documents
         WHERE document_date IS NOT NULL
           AND number ~ '^[0-9]{2}\\.[0-9]{2}/[0-9]+$'

         UNION ALL

         SELECT
           EXTRACT(YEAR FROM signed_at)::INTEGER AS year,
           EXTRACT(MONTH FROM signed_at)::INTEGER AS month,
           CAST(split_part(number, '/', 2) AS INTEGER) AS seq
         FROM match_protocol_snapshots
         WHERE signed_at IS NOT NULL
           AND number ~ '^[0-9]{2}\\.[0-9]{2}/[0-9]+$'
       ) numbered_sources
       GROUP BY year, month`
    );

    await queryInterface.addColumn('match_protocol_snapshots', 'document_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'documents', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('match_protocol_snapshots', ['document_id'], {
      name: 'idx_match_protocol_snapshots_document_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'match_protocol_snapshots',
      'idx_match_protocol_snapshots_document_id'
    );
    await queryInterface.removeColumn(
      'match_protocol_snapshots',
      'document_id'
    );

    await queryInterface.sequelize.query(
      'ALTER TABLE number_counters DROP CONSTRAINT IF EXISTS number_counters_pkey'
    );
    await queryInterface.sequelize.query('DELETE FROM number_counters');
    await queryInterface.sequelize.query(
      `INSERT INTO number_counters (
         scope,
         year,
         month,
         last_seq,
         created_at,
         updated_at
       )
       SELECT
         'DOCUMENT' AS scope,
         EXTRACT(YEAR FROM document_date)::INTEGER AS year,
         1 AS month,
         MAX(CAST(split_part(number, '/', 2) AS INTEGER)) AS last_seq,
         NOW(),
         NOW()
       FROM documents
       WHERE document_date IS NOT NULL
         AND number ~ '^[0-9]{2}\\.[0-9]{2}/[0-9]+$'
       GROUP BY EXTRACT(YEAR FROM document_date)::INTEGER`
    );
    await queryInterface.removeColumn('number_counters', 'month');
    await queryInterface.sequelize.query(
      'ALTER TABLE number_counters ADD PRIMARY KEY (scope, year)'
    );
  },
};
