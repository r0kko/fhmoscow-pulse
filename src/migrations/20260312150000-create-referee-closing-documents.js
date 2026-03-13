'use strict';

async function upsertByAlias(queryInterface, tableName, rows) {
  for (const row of rows) {
    const columns = Object.keys(row);
    const values = columns.map((column) => `:${column}`);
    const updates = columns
      .filter((column) => column !== 'alias')
      .map((column) => `${column} = :${column}`);

    if (updates.length) {
      await queryInterface.sequelize.query(
        `UPDATE ${tableName}
            SET ${updates.join(', ')},
                updated_at = NOW()
          WHERE alias = :alias
            AND deleted_at IS NULL`,
        {
          replacements: row,
        }
      );
    }

    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT 1
         FROM ${tableName}
        WHERE alias = :alias
          AND deleted_at IS NULL
        LIMIT 1`,
      {
        replacements: row,
      }
    );

    if (existingRows?.length) continue;

    await queryInterface.sequelize.query(
      `INSERT INTO ${tableName} (${columns.join(', ')}, created_at, updated_at)
       VALUES (${values.join(', ')}, NOW(), NOW())`,
      {
        replacements: row,
      }
    );
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = Sequelize.literal('NOW()');

    await upsertByAlias(queryInterface, 'referee_accrual_document_statuses', [
      {
        alias: 'AWAITING_SIGNATURE',
        name_ru: 'Ожидает подписания',
        display_order: 30,
        is_terminal: false,
        allow_bulk: true,
        is_active: true,
      },
      {
        alias: 'POSTED',
        name_ru: 'Проведен',
        display_order: 40,
        is_terminal: false,
        allow_bulk: true,
        is_active: true,
      },
      {
        alias: 'DELETED',
        name_ru: 'Удалено',
        display_order: 50,
        is_terminal: true,
        allow_bulk: true,
        is_active: true,
      },
    ]);

    await queryInterface.sequelize.query(
      `UPDATE referee_accrual_document_statuses
          SET is_active = false,
              updated_at = NOW()
        WHERE alias IN ('REVIEWED', 'APPROVED', 'VOID')`
    );

    await upsertByAlias(queryInterface, 'document_types', [
      {
        alias: 'REFEREE_CLOSING_ACT',
        name: 'Акт выполненных работ',
        generated: true,
      },
    ]);

    await upsertByAlias(queryInterface, 'document_statuses', [
      {
        alias: 'CANCELED',
        name: 'Отменен',
      },
    ]);

    await queryInterface.createTable('referee_closing_document_profiles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      tournament_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tournaments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        unique: true,
      },
      organizer_inn: { type: Sequelize.STRING(12), allowNull: true },
      organizer_name: { type: Sequelize.STRING(255), allowNull: true },
      organizer_short_name: { type: Sequelize.STRING(255), allowNull: true },
      organizer_kpp: { type: Sequelize.STRING(9), allowNull: true },
      organizer_ogrn: { type: Sequelize.STRING(15), allowNull: true },
      organizer_address: { type: Sequelize.STRING(500), allowNull: true },
      organizer_json: { type: Sequelize.JSONB, allowNull: true },
      dadata_payload: { type: Sequelize.JSONB, allowNull: true },
      last_verified_at: { type: Sequelize.DATE, allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: now },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: now },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.createTable('referee_closing_documents', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      tournament_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tournaments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      referee_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      document_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'documents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      customer_snapshot_json: { type: Sequelize.JSONB, allowNull: false },
      performer_snapshot_json: { type: Sequelize.JSONB, allowNull: false },
      fhmo_signer_snapshot_json: { type: Sequelize.JSONB, allowNull: true },
      totals_json: { type: Sequelize.JSONB, allowNull: false },
      sent_at: { type: Sequelize.DATE, allowNull: true },
      posted_at: { type: Sequelize.DATE, allowNull: true },
      canceled_at: { type: Sequelize.DATE, allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: now },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: now },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex(
      'referee_closing_documents',
      ['tournament_id', 'status', 'created_at'],
      { name: 'idx_referee_closing_documents_tournament_status_created' }
    );
    await queryInterface.addIndex(
      'referee_closing_documents',
      ['referee_id', 'status', 'created_at'],
      { name: 'idx_referee_closing_documents_referee_status_created' }
    );

    await queryInterface.createTable('referee_closing_document_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      closing_document_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'referee_closing_documents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      accrual_document_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'referee_accrual_documents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      line_no: { type: Sequelize.INTEGER, allowNull: false },
      snapshot_json: { type: Sequelize.JSONB, allowNull: false },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: now },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: now },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex(
      'referee_closing_document_items',
      ['closing_document_id', 'line_no'],
      { name: 'idx_referee_closing_document_items_doc_line' }
    );
    await queryInterface.addIndex(
      'referee_closing_document_items',
      ['accrual_document_id'],
      {
        name: 'uq_referee_closing_document_items_accrual_active',
        unique: true,
        where: { deleted_at: null },
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'referee_closing_document_items',
      'uq_referee_closing_document_items_accrual_active'
    );
    await queryInterface.removeIndex(
      'referee_closing_document_items',
      'idx_referee_closing_document_items_doc_line'
    );
    await queryInterface.dropTable('referee_closing_document_items');

    await queryInterface.removeIndex(
      'referee_closing_documents',
      'idx_referee_closing_documents_referee_status_created'
    );
    await queryInterface.removeIndex(
      'referee_closing_documents',
      'idx_referee_closing_documents_tournament_status_created'
    );
    await queryInterface.dropTable('referee_closing_documents');
    await queryInterface.dropTable('referee_closing_document_profiles');
  },
};
