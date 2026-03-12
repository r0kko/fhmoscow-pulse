'use strict';

async function tableExists(queryInterface, tableName) {
  const [row] = await queryInterface.sequelize.query(
    'SELECT to_regclass(:name) IS NOT NULL AS exists',
    {
      replacements: { name: tableName },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    }
  );
  return Boolean(row?.exists);
}

async function getLookupId(queryInterface, tableName, alias) {
  const [row] = await queryInterface.sequelize.query(
    `SELECT id FROM ${tableName} WHERE alias = :alias LIMIT 1`,
    {
      replacements: { alias },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    }
  );
  return row?.id || null;
}

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

    if (existingRows?.length) {
      continue;
    }

    await queryInterface.sequelize.query(
      `INSERT INTO ${tableName} (${columns.join(', ')}, created_at, updated_at)
       VALUES (${values.join(', ')}, NOW(), NOW())`,
      {
        replacements: row,
      }
    );
  }
}

async function up(queryInterface, Sequelize) {
  const now = Sequelize.literal('NOW()');

  if (!(await tableExists(queryInterface, 'referee_accrual_number_counters'))) {
    await queryInterface.createTable('referee_accrual_number_counters', {
      period_yyyymm: {
        type: Sequelize.STRING(6),
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
        defaultValue: now,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: now,
      },
    });
  }

  await upsertByAlias(queryInterface, 'referee_accrual_document_statuses', [
    {
      alias: 'DRAFT',
      name_ru: 'Черновик',
      display_order: 10,
      is_terminal: false,
      allow_bulk: true,
      is_active: true,
    },
    {
      alias: 'ACCRUED',
      name_ru: 'Начислено',
      display_order: 20,
      is_terminal: false,
      allow_bulk: true,
      is_active: true,
    },
  ]);

  await queryInterface.sequelize.query(
    `UPDATE referee_accrual_document_statuses
        SET is_active = false,
            updated_at = NOW()
      WHERE alias IN ('REVIEWED', 'APPROVED', 'POSTED', 'VOID')`
  );

  const draftStatusId = await getLookupId(
    queryInterface,
    'referee_accrual_document_statuses',
    'DRAFT'
  );
  const accruedStatusId = await getLookupId(
    queryInterface,
    'referee_accrual_document_statuses',
    'ACCRUED'
  );
  const reviewedStatusId = await getLookupId(
    queryInterface,
    'referee_accrual_document_statuses',
    'REVIEWED'
  );
  const approvedStatusId = await getLookupId(
    queryInterface,
    'referee_accrual_document_statuses',
    'APPROVED'
  );
  const postedStatusId = await getLookupId(
    queryInterface,
    'referee_accrual_document_statuses',
    'POSTED'
  );
  const voidStatusId = await getLookupId(
    queryInterface,
    'referee_accrual_document_statuses',
    'VOID'
  );

  if (accruedStatusId) {
    const legacyIds = [
      reviewedStatusId,
      approvedStatusId,
      postedStatusId,
    ].filter(Boolean);
    if (legacyIds.length) {
      await queryInterface.sequelize.query(
        `UPDATE referee_accrual_documents
            SET document_status_id = :accrued_id,
                updated_at = NOW()
          WHERE document_status_id IN (:legacy_ids)`,
        {
          replacements: {
            accrued_id: accruedStatusId,
            legacy_ids: legacyIds,
          },
        }
      );
    }

    if (voidStatusId) {
      await queryInterface.sequelize.query(
        `UPDATE referee_accrual_documents
            SET document_status_id = :accrued_id,
                deleted_at = COALESCE(deleted_at, NOW()),
                updated_at = NOW()
          WHERE document_status_id = :void_id`,
        {
          replacements: {
            accrued_id: accruedStatusId,
            void_id: voidStatusId,
          },
        }
      );
    }
  }

  await upsertByAlias(queryInterface, 'referee_accounting_actions', [
    {
      alias: 'APPROVE',
      scope: 'ACCRUAL',
      name_ru: 'Начислить',
      requires_comment: false,
      maker_checker_guard: true,
      display_order: 10,
      is_active: true,
    },
    {
      alias: 'DELETE',
      scope: 'ACCRUAL',
      name_ru: 'Удалить',
      requires_comment: true,
      maker_checker_guard: false,
      display_order: 20,
      is_active: true,
    },
  ]);

  await queryInterface.sequelize.query(
    `UPDATE referee_accounting_actions
        SET is_active = false,
            updated_at = NOW()
      WHERE alias IN ('REVIEW', 'POST', 'VOID', 'ADJUST')
        AND scope = 'ACCRUAL'`
  );

  if (await tableExists(queryInterface, 'referee_accrual_status_transitions')) {
    const approveActionId = await getLookupId(
      queryInterface,
      'referee_accounting_actions',
      'APPROVE'
    );

    await queryInterface.sequelize.query(
      `UPDATE referee_accrual_status_transitions
          SET is_enabled = false,
              updated_at = NOW()`
    );

    if (draftStatusId && accruedStatusId && approveActionId) {
      await queryInterface.sequelize.query(
        `UPDATE referee_accrual_status_transitions
            SET to_status_id = :to_status_id,
                is_enabled = true,
                updated_at = NOW()
          WHERE from_status_id = :from_status_id
            AND action_id = :action_id
            AND deleted_at IS NULL`,
        {
          replacements: {
            from_status_id: draftStatusId,
            action_id: approveActionId,
            to_status_id: accruedStatusId,
          },
        }
      );

      const [existingRows] = await queryInterface.sequelize.query(
        `SELECT 1
           FROM referee_accrual_status_transitions
          WHERE from_status_id = :from_status_id
            AND action_id = :action_id
            AND deleted_at IS NULL
          LIMIT 1`,
        {
          replacements: {
            from_status_id: draftStatusId,
            action_id: approveActionId,
          },
        }
      );

      if (!existingRows?.length) {
        await queryInterface.sequelize.query(
          `INSERT INTO referee_accrual_status_transitions (from_status_id, action_id, to_status_id, is_enabled, created_at, updated_at)
         VALUES (:from_status_id, :action_id, :to_status_id, true, NOW(), NOW())`,
          {
            replacements: {
              from_status_id: draftStatusId,
              action_id: approveActionId,
              to_status_id: accruedStatusId,
            },
          }
        );
      }
    }
  }

  await queryInterface.sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_referee_accrual_documents_status_deleted_date
       ON referee_accrual_documents (document_status_id, deleted_at, match_date_snapshot)`
  );
  await queryInterface.sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_referee_accrual_documents_deleted_created
       ON referee_accrual_documents (deleted_at, created_at)`
  );
}

async function down(queryInterface) {
  await queryInterface.sequelize.query(
    'DROP INDEX IF EXISTS idx_referee_accrual_documents_status_deleted_date'
  );
  await queryInterface.sequelize.query(
    'DROP INDEX IF EXISTS idx_referee_accrual_documents_deleted_created'
  );

  await queryInterface.sequelize.query(
    `UPDATE referee_accounting_actions
        SET is_active = true,
            updated_at = NOW()
      WHERE alias IN ('REVIEW', 'POST', 'VOID', 'ADJUST')
        AND scope = 'ACCRUAL'`
  );

  await queryInterface.sequelize.query(
    `UPDATE referee_accrual_document_statuses
        SET is_active = true,
            updated_at = NOW()
      WHERE alias IN ('REVIEWED', 'APPROVED', 'POSTED', 'VOID')`
  );

  if (await tableExists(queryInterface, 'referee_accrual_number_counters')) {
    await queryInterface.dropTable('referee_accrual_number_counters');
  }
}

module.exports = {
  up,
  down,
};
