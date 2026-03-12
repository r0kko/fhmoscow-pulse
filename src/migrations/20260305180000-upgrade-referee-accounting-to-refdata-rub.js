'use strict';

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function columnExists(queryInterface, tableName, columnName) {
  try {
    const table = await queryInterface.describeTable(tableName);
    return Object.hasOwn(table, columnName);
  } catch {
    return false;
  }
}

async function ensureConstraint(queryInterface, constraintName, alterSql) {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT 1 FROM pg_constraint WHERE conname = :name LIMIT 1',
    {
      replacements: { name: constraintName },
    }
  );
  if (!rows?.length) {
    await queryInterface.sequelize.query(alterSql);
  }
}

async function ensureLookupTable(
  queryInterface,
  Sequelize,
  tableName,
  extra = {}
) {
  const exists = await tableExists(queryInterface, tableName);
  if (exists) return;

  await queryInterface.createTable(tableName, {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.literal('uuid_generate_v4()'),
      primaryKey: true,
    },
    alias: {
      type: Sequelize.STRING(32),
      allowNull: false,
      unique: true,
    },
    name_ru: {
      type: Sequelize.STRING(128),
      allowNull: false,
    },
    display_order: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    is_active: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    ...extra,
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
}

async function upsertLookup(queryInterface, tableName, rows) {
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

async function getLookupId(queryInterface, tableName, alias) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT id FROM ${tableName} WHERE alias = :alias ORDER BY created_at DESC LIMIT 1`,
    {
      replacements: { alias },
    }
  );
  return rows?.[0]?.id || null;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await ensureLookupTable(
      queryInterface,
      Sequelize,
      'referee_tariff_statuses'
    );
    await ensureLookupTable(
      queryInterface,
      Sequelize,
      'ground_travel_rate_statuses'
    );
    await ensureLookupTable(
      queryInterface,
      Sequelize,
      'referee_accrual_document_statuses',
      {
        is_terminal: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        allow_bulk: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
      }
    );
    await ensureLookupTable(
      queryInterface,
      Sequelize,
      'referee_accrual_sources'
    );
    await ensureLookupTable(
      queryInterface,
      Sequelize,
      'referee_accrual_posting_types'
    );
    await ensureLookupTable(
      queryInterface,
      Sequelize,
      'referee_accrual_components'
    );

    const actionsExists = await tableExists(
      queryInterface,
      'referee_accounting_actions'
    );
    if (!actionsExists) {
      await queryInterface.createTable('referee_accounting_actions', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.literal('uuid_generate_v4()'),
          primaryKey: true,
        },
        alias: {
          type: Sequelize.STRING(32),
          allowNull: false,
          unique: true,
        },
        scope: {
          type: Sequelize.STRING(16),
          allowNull: false,
        },
        name_ru: {
          type: Sequelize.STRING(128),
          allowNull: false,
        },
        requires_comment: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        maker_checker_guard: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        display_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 100,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
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
    }

    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_referee_tariff_statuses_alias ON referee_tariff_statuses (alias)'
    );
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_ground_travel_rate_statuses_alias ON ground_travel_rate_statuses (alias)'
    );
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_referee_accrual_document_statuses_alias ON referee_accrual_document_statuses (alias)'
    );
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_referee_accrual_sources_alias ON referee_accrual_sources (alias)'
    );
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_referee_accrual_posting_types_alias ON referee_accrual_posting_types (alias)'
    );
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_referee_accrual_components_alias ON referee_accrual_components (alias)'
    );
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_referee_accounting_actions_alias ON referee_accounting_actions (alias)'
    );

    await upsertLookup(queryInterface, 'referee_tariff_statuses', [
      {
        alias: 'DRAFT',
        name_ru: 'Черновик',
        display_order: 10,
        is_active: true,
      },
      {
        alias: 'FILED',
        name_ru: 'На согласовании',
        display_order: 20,
        is_active: true,
      },
      {
        alias: 'ACTIVE',
        name_ru: 'Действует',
        display_order: 30,
        is_active: true,
      },
      {
        alias: 'RETIRED',
        name_ru: 'Архив',
        display_order: 40,
        is_active: true,
      },
    ]);

    await upsertLookup(queryInterface, 'ground_travel_rate_statuses', [
      {
        alias: 'DRAFT',
        name_ru: 'Черновик',
        display_order: 10,
        is_active: true,
      },
      {
        alias: 'ACTIVE',
        name_ru: 'Действует',
        display_order: 20,
        is_active: true,
      },
      {
        alias: 'RETIRED',
        name_ru: 'Архив',
        display_order: 30,
        is_active: true,
      },
    ]);

    await upsertLookup(queryInterface, 'referee_accrual_document_statuses', [
      {
        alias: 'DRAFT',
        name_ru: 'Черновик',
        display_order: 10,
        is_terminal: false,
        allow_bulk: true,
        is_active: true,
      },
      {
        alias: 'REVIEWED',
        name_ru: 'Проверено',
        display_order: 20,
        is_terminal: false,
        allow_bulk: true,
        is_active: true,
      },
      {
        alias: 'APPROVED',
        name_ru: 'Утверждено',
        display_order: 30,
        is_terminal: false,
        allow_bulk: true,
        is_active: true,
      },
      {
        alias: 'POSTED',
        name_ru: 'Проведено',
        display_order: 40,
        is_terminal: false,
        allow_bulk: true,
        is_active: true,
      },
      {
        alias: 'VOID',
        name_ru: 'Аннулировано',
        display_order: 50,
        is_terminal: true,
        allow_bulk: true,
        is_active: true,
      },
    ]);

    await upsertLookup(queryInterface, 'referee_accrual_sources', [
      {
        alias: 'MANUAL',
        name_ru: 'Вручную',
        display_order: 10,
        is_active: true,
      },
      {
        alias: 'CRON',
        name_ru: 'По расписанию',
        display_order: 20,
        is_active: true,
      },
    ]);

    await upsertLookup(queryInterface, 'referee_accrual_posting_types', [
      {
        alias: 'ORIGINAL',
        name_ru: 'Первичная',
        display_order: 10,
        is_active: true,
      },
      {
        alias: 'ADJUSTMENT',
        name_ru: 'Корректировка',
        display_order: 20,
        is_active: true,
      },
      {
        alias: 'REVERSAL',
        name_ru: 'Сторно',
        display_order: 30,
        is_active: true,
      },
    ]);

    await upsertLookup(queryInterface, 'referee_accrual_components', [
      { alias: 'BASE', name_ru: 'База', display_order: 10, is_active: true },
      { alias: 'MEAL', name_ru: 'Питание', display_order: 20, is_active: true },
      {
        alias: 'TRAVEL',
        name_ru: 'Проезд',
        display_order: 30,
        is_active: true,
      },
    ]);

    await upsertLookup(queryInterface, 'referee_accounting_actions', [
      {
        alias: 'FILE',
        scope: 'TARIFF',
        name_ru: 'На согласование',
        requires_comment: false,
        maker_checker_guard: false,
        display_order: 10,
        is_active: true,
      },
      {
        alias: 'ACTIVATE',
        scope: 'TARIFF',
        name_ru: 'Активировать',
        requires_comment: false,
        maker_checker_guard: false,
        display_order: 20,
        is_active: true,
      },
      {
        alias: 'RETIRE',
        scope: 'TARIFF',
        name_ru: 'В архив',
        requires_comment: false,
        maker_checker_guard: false,
        display_order: 30,
        is_active: true,
      },
      {
        alias: 'REVIEW',
        scope: 'ACCRUAL',
        name_ru: 'Проверить',
        requires_comment: false,
        maker_checker_guard: false,
        display_order: 40,
        is_active: true,
      },
      {
        alias: 'APPROVE',
        scope: 'ACCRUAL',
        name_ru: 'Утвердить',
        requires_comment: false,
        maker_checker_guard: true,
        display_order: 50,
        is_active: true,
      },
      {
        alias: 'POST',
        scope: 'ACCRUAL',
        name_ru: 'Провести',
        requires_comment: false,
        maker_checker_guard: true,
        display_order: 60,
        is_active: true,
      },
      {
        alias: 'VOID',
        scope: 'ACCRUAL',
        name_ru: 'Аннулировать',
        requires_comment: true,
        maker_checker_guard: false,
        display_order: 70,
        is_active: true,
      },
      {
        alias: 'ADJUST',
        scope: 'ACCRUAL',
        name_ru: 'Корректировка',
        requires_comment: true,
        maker_checker_guard: false,
        display_order: 80,
        is_active: true,
      },
    ]);

    const transitionsExists = await tableExists(
      queryInterface,
      'referee_accrual_status_transitions'
    );
    if (!transitionsExists) {
      await queryInterface.createTable('referee_accrual_status_transitions', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.literal('uuid_generate_v4()'),
          primaryKey: true,
        },
        from_status_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'referee_accrual_document_statuses', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        action_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'referee_accounting_actions', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        to_status_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'referee_accrual_document_statuses', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        is_enabled: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
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
    }
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_referee_accrual_status_transitions_from_action ON referee_accrual_status_transitions (from_status_id, action_id)'
    );

    const statusDraftId = await getLookupId(
      queryInterface,
      'referee_accrual_document_statuses',
      'DRAFT'
    );
    const statusReviewedId = await getLookupId(
      queryInterface,
      'referee_accrual_document_statuses',
      'REVIEWED'
    );
    const statusApprovedId = await getLookupId(
      queryInterface,
      'referee_accrual_document_statuses',
      'APPROVED'
    );
    const statusPostedId = await getLookupId(
      queryInterface,
      'referee_accrual_document_statuses',
      'POSTED'
    );
    const statusVoidId = await getLookupId(
      queryInterface,
      'referee_accrual_document_statuses',
      'VOID'
    );

    const actionReviewId = await getLookupId(
      queryInterface,
      'referee_accounting_actions',
      'REVIEW'
    );
    const actionApproveId = await getLookupId(
      queryInterface,
      'referee_accounting_actions',
      'APPROVE'
    );
    const actionPostId = await getLookupId(
      queryInterface,
      'referee_accounting_actions',
      'POST'
    );
    const actionVoidId = await getLookupId(
      queryInterface,
      'referee_accounting_actions',
      'VOID'
    );

    const transitions = [
      [statusDraftId, actionReviewId, statusReviewedId],
      [statusDraftId, actionApproveId, statusApprovedId],
      [statusDraftId, actionVoidId, statusVoidId],
      [statusReviewedId, actionApproveId, statusApprovedId],
      [statusReviewedId, actionVoidId, statusVoidId],
      [statusApprovedId, actionPostId, statusPostedId],
      [statusApprovedId, actionVoidId, statusVoidId],
      [statusPostedId, actionVoidId, statusVoidId],
    ];
    for (const [fromStatus, action, toStatus] of transitions) {
      if (!fromStatus || !action || !toStatus) continue;
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
            from_status_id: fromStatus,
            action_id: action,
            to_status_id: toStatus,
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
            from_status_id: fromStatus,
            action_id: action,
          },
        }
      );

      if (existingRows?.length) continue;

      await queryInterface.sequelize.query(
        `INSERT INTO referee_accrual_status_transitions (from_status_id, action_id, to_status_id, is_enabled, created_at, updated_at)
         VALUES (:from_status_id, :action_id, :to_status_id, true, NOW(), NOW())`,
        {
          replacements: {
            from_status_id: fromStatus,
            action_id: action,
            to_status_id: toStatus,
          },
        }
      );
    }

    // Tariff rules: RUB + FK status
    if (
      await columnExists(
        queryInterface,
        'referee_tariff_rules',
        'base_amount_kop'
      )
    ) {
      if (
        !(await columnExists(
          queryInterface,
          'referee_tariff_rules',
          'base_amount_rub'
        ))
      ) {
        await queryInterface.addColumn(
          'referee_tariff_rules',
          'base_amount_rub',
          {
            type: Sequelize.DECIMAL(12, 2),
            allowNull: true,
          }
        );
      }
      if (
        !(await columnExists(
          queryInterface,
          'referee_tariff_rules',
          'meal_amount_rub'
        ))
      ) {
        await queryInterface.addColumn(
          'referee_tariff_rules',
          'meal_amount_rub',
          {
            type: Sequelize.DECIMAL(12, 2),
            allowNull: true,
          }
        );
      }
      await queryInterface.sequelize.query(
        `UPDATE referee_tariff_rules
         SET base_amount_rub = ROUND(base_amount_kop::numeric / 100.0, 2),
             meal_amount_rub = ROUND(meal_amount_kop::numeric / 100.0, 2)
         WHERE base_amount_rub IS NULL OR meal_amount_rub IS NULL`
      );
    }
    if (
      !(await columnExists(
        queryInterface,
        'referee_tariff_rules',
        'tariff_status_id'
      ))
    ) {
      await queryInterface.addColumn(
        'referee_tariff_rules',
        'tariff_status_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
        }
      );
    }
    if (await columnExists(queryInterface, 'referee_tariff_rules', 'status')) {
      await queryInterface.sequelize.query(
        `UPDATE referee_tariff_rules t
         SET tariff_status_id = s.id
         FROM referee_tariff_statuses s
         WHERE s.alias = COALESCE(NULLIF(t.status, ''), 'DRAFT')
           AND t.tariff_status_id IS NULL`
      );
    }
    const defaultTariffStatusId = await getLookupId(
      queryInterface,
      'referee_tariff_statuses',
      'DRAFT'
    );
    await queryInterface.sequelize.query(
      `UPDATE referee_tariff_rules
       SET tariff_status_id = :id
       WHERE tariff_status_id IS NULL`,
      { replacements: { id: defaultTariffStatusId } }
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE referee_tariff_rules
       ALTER COLUMN tariff_status_id SET NOT NULL,
       ALTER COLUMN base_amount_rub SET NOT NULL,
       ALTER COLUMN meal_amount_rub SET NOT NULL`
    );

    // Travel rates: RUB + FK status
    if (
      await columnExists(
        queryInterface,
        'ground_referee_travel_rates',
        'travel_amount_kop'
      )
    ) {
      if (
        !(await columnExists(
          queryInterface,
          'ground_referee_travel_rates',
          'travel_amount_rub'
        ))
      ) {
        await queryInterface.addColumn(
          'ground_referee_travel_rates',
          'travel_amount_rub',
          {
            type: Sequelize.DECIMAL(12, 2),
            allowNull: true,
          }
        );
      }
      await queryInterface.sequelize.query(
        `UPDATE ground_referee_travel_rates
         SET travel_amount_rub = ROUND(travel_amount_kop::numeric / 100.0, 2)
         WHERE travel_amount_rub IS NULL`
      );
    }
    if (
      !(await columnExists(
        queryInterface,
        'ground_referee_travel_rates',
        'travel_rate_status_id'
      ))
    ) {
      await queryInterface.addColumn(
        'ground_referee_travel_rates',
        'travel_rate_status_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
        }
      );
    }
    if (
      await columnExists(
        queryInterface,
        'ground_referee_travel_rates',
        'status'
      )
    ) {
      await queryInterface.sequelize.query(
        `UPDATE ground_referee_travel_rates r
         SET travel_rate_status_id = s.id
         FROM ground_travel_rate_statuses s
         WHERE s.alias = COALESCE(NULLIF(r.status, ''), 'ACTIVE')
           AND r.travel_rate_status_id IS NULL`
      );
    }
    const defaultTravelStatusId = await getLookupId(
      queryInterface,
      'ground_travel_rate_statuses',
      'ACTIVE'
    );
    await queryInterface.sequelize.query(
      `UPDATE ground_referee_travel_rates
       SET travel_rate_status_id = :id
       WHERE travel_rate_status_id IS NULL`,
      { replacements: { id: defaultTravelStatusId } }
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE ground_referee_travel_rates
       ALTER COLUMN travel_rate_status_id SET NOT NULL,
       ALTER COLUMN travel_amount_rub SET NOT NULL`
    );

    // Accrual documents: RUB + FK status/source
    if (
      await columnExists(
        queryInterface,
        'referee_accrual_documents',
        'base_amount_kop'
      )
    ) {
      for (const col of [
        'base_amount_rub',
        'meal_amount_rub',
        'travel_amount_rub',
        'total_amount_rub',
      ]) {
        if (
          !(await columnExists(
            queryInterface,
            'referee_accrual_documents',
            col
          ))
        ) {
          await queryInterface.addColumn('referee_accrual_documents', col, {
            type: Sequelize.DECIMAL(12, 2),
            allowNull: true,
          });
        }
      }

      await queryInterface.sequelize.query(
        `UPDATE referee_accrual_documents
         SET base_amount_rub = ROUND(base_amount_kop::numeric / 100.0, 2),
             meal_amount_rub = ROUND(meal_amount_kop::numeric / 100.0, 2),
             travel_amount_rub = ROUND(travel_amount_kop::numeric / 100.0, 2),
             total_amount_rub = ROUND(total_amount_kop::numeric / 100.0, 2)
         WHERE base_amount_rub IS NULL
            OR meal_amount_rub IS NULL
            OR travel_amount_rub IS NULL
            OR total_amount_rub IS NULL`
      );
    }

    if (
      !(await columnExists(
        queryInterface,
        'referee_accrual_documents',
        'document_status_id'
      ))
    ) {
      await queryInterface.addColumn(
        'referee_accrual_documents',
        'document_status_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
        }
      );
    }
    if (
      !(await columnExists(
        queryInterface,
        'referee_accrual_documents',
        'source_id'
      ))
    ) {
      await queryInterface.addColumn('referee_accrual_documents', 'source_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    if (
      await columnExists(queryInterface, 'referee_accrual_documents', 'status')
    ) {
      await queryInterface.sequelize.query(
        `UPDATE referee_accrual_documents d
         SET document_status_id = s.id
         FROM referee_accrual_document_statuses s
         WHERE s.alias = COALESCE(NULLIF(d.status, ''), 'DRAFT')
           AND d.document_status_id IS NULL`
      );
    }
    if (
      await columnExists(queryInterface, 'referee_accrual_documents', 'source')
    ) {
      await queryInterface.sequelize.query(
        `UPDATE referee_accrual_documents d
         SET source_id = s.id
         FROM referee_accrual_sources s
         WHERE s.alias = COALESCE(NULLIF(d.source, ''), 'MANUAL')
           AND d.source_id IS NULL`
      );
    }

    const defaultDocumentStatusId = await getLookupId(
      queryInterface,
      'referee_accrual_document_statuses',
      'DRAFT'
    );
    const defaultSourceId = await getLookupId(
      queryInterface,
      'referee_accrual_sources',
      'MANUAL'
    );
    await queryInterface.sequelize.query(
      `UPDATE referee_accrual_documents
       SET document_status_id = :status_id
       WHERE document_status_id IS NULL`,
      {
        replacements: { status_id: defaultDocumentStatusId },
      }
    );
    await queryInterface.sequelize.query(
      `UPDATE referee_accrual_documents
       SET source_id = :source_id
       WHERE source_id IS NULL`,
      {
        replacements: { source_id: defaultSourceId },
      }
    );

    await queryInterface.sequelize.query(
      `ALTER TABLE referee_accrual_documents
       ALTER COLUMN document_status_id SET NOT NULL,
       ALTER COLUMN source_id SET NOT NULL,
       ALTER COLUMN base_amount_rub SET NOT NULL,
       ALTER COLUMN meal_amount_rub SET NOT NULL,
       ALTER COLUMN travel_amount_rub SET NOT NULL,
       ALTER COLUMN total_amount_rub SET NOT NULL`
    );

    // Accrual postings: RUB + FK type/component
    if (
      await columnExists(
        queryInterface,
        'referee_accrual_postings',
        'amount_kop'
      )
    ) {
      if (
        !(await columnExists(
          queryInterface,
          'referee_accrual_postings',
          'amount_rub'
        ))
      ) {
        await queryInterface.addColumn(
          'referee_accrual_postings',
          'amount_rub',
          {
            type: Sequelize.DECIMAL(12, 2),
            allowNull: true,
          }
        );
      }
      await queryInterface.sequelize.query(
        `UPDATE referee_accrual_postings
         SET amount_rub = ROUND(amount_kop::numeric / 100.0, 2)
         WHERE amount_rub IS NULL`
      );
    }

    if (
      !(await columnExists(
        queryInterface,
        'referee_accrual_postings',
        'posting_type_id'
      ))
    ) {
      await queryInterface.addColumn(
        'referee_accrual_postings',
        'posting_type_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
        }
      );
    }
    if (
      !(await columnExists(
        queryInterface,
        'referee_accrual_postings',
        'component_id'
      ))
    ) {
      await queryInterface.addColumn(
        'referee_accrual_postings',
        'component_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
        }
      );
    }

    if (
      await columnExists(
        queryInterface,
        'referee_accrual_postings',
        'posting_type'
      )
    ) {
      await queryInterface.sequelize.query(
        `UPDATE referee_accrual_postings p
         SET posting_type_id = t.id
         FROM referee_accrual_posting_types t
         WHERE t.alias = COALESCE(NULLIF(p.posting_type, ''), 'ORIGINAL')
           AND p.posting_type_id IS NULL`
      );
    }
    if (
      await columnExists(
        queryInterface,
        'referee_accrual_postings',
        'component'
      )
    ) {
      await queryInterface.sequelize.query(
        `UPDATE referee_accrual_postings p
         SET component_id = c.id
         FROM referee_accrual_components c
         WHERE c.alias = COALESCE(NULLIF(p.component, ''), 'BASE')
           AND p.component_id IS NULL`
      );
    }

    const defaultPostingTypeId = await getLookupId(
      queryInterface,
      'referee_accrual_posting_types',
      'ORIGINAL'
    );
    const defaultComponentId = await getLookupId(
      queryInterface,
      'referee_accrual_components',
      'BASE'
    );
    await queryInterface.sequelize.query(
      `UPDATE referee_accrual_postings
       SET posting_type_id = :type_id
       WHERE posting_type_id IS NULL`,
      {
        replacements: { type_id: defaultPostingTypeId },
      }
    );
    await queryInterface.sequelize.query(
      `UPDATE referee_accrual_postings
       SET component_id = :component_id
       WHERE component_id IS NULL`,
      {
        replacements: { component_id: defaultComponentId },
      }
    );

    await queryInterface.sequelize.query(
      `ALTER TABLE referee_accrual_postings
       ALTER COLUMN posting_type_id SET NOT NULL,
       ALTER COLUMN component_id SET NOT NULL,
       ALTER COLUMN amount_rub SET NOT NULL`
    );

    // Foreign keys and indexes
    await ensureConstraint(
      queryInterface,
      'fk_referee_tariff_rules_tariff_status',
      `ALTER TABLE referee_tariff_rules
       ADD CONSTRAINT fk_referee_tariff_rules_tariff_status
       FOREIGN KEY (tariff_status_id)
       REFERENCES referee_tariff_statuses(id)
       ON UPDATE CASCADE ON DELETE RESTRICT`
    );

    await ensureConstraint(
      queryInterface,
      'fk_ground_referee_travel_rates_status',
      `ALTER TABLE ground_referee_travel_rates
       ADD CONSTRAINT fk_ground_referee_travel_rates_status
       FOREIGN KEY (travel_rate_status_id)
       REFERENCES ground_travel_rate_statuses(id)
       ON UPDATE CASCADE ON DELETE RESTRICT`
    );

    await ensureConstraint(
      queryInterface,
      'fk_referee_accrual_documents_status',
      `ALTER TABLE referee_accrual_documents
       ADD CONSTRAINT fk_referee_accrual_documents_status
       FOREIGN KEY (document_status_id)
       REFERENCES referee_accrual_document_statuses(id)
       ON UPDATE CASCADE ON DELETE RESTRICT`
    );

    await ensureConstraint(
      queryInterface,
      'fk_referee_accrual_documents_source',
      `ALTER TABLE referee_accrual_documents
       ADD CONSTRAINT fk_referee_accrual_documents_source
       FOREIGN KEY (source_id)
       REFERENCES referee_accrual_sources(id)
       ON UPDATE CASCADE ON DELETE RESTRICT`
    );

    await ensureConstraint(
      queryInterface,
      'fk_referee_accrual_postings_posting_type',
      `ALTER TABLE referee_accrual_postings
       ADD CONSTRAINT fk_referee_accrual_postings_posting_type
       FOREIGN KEY (posting_type_id)
       REFERENCES referee_accrual_posting_types(id)
       ON UPDATE CASCADE ON DELETE RESTRICT`
    );

    await ensureConstraint(
      queryInterface,
      'fk_referee_accrual_postings_component',
      `ALTER TABLE referee_accrual_postings
       ADD CONSTRAINT fk_referee_accrual_postings_component
       FOREIGN KEY (component_id)
       REFERENCES referee_accrual_components(id)
       ON UPDATE CASCADE ON DELETE RESTRICT`
    );

    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_referee_tariff_rules_scope_status_fk
       ON referee_tariff_rules (tournament_id, stage_group_id, referee_role_id, tariff_status_id)`
    );
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_ground_referee_travel_rates_scope_status_fk
       ON ground_referee_travel_rates (ground_id, travel_rate_status_id)`
    );
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_referee_accrual_documents_status_date_fk
       ON referee_accrual_documents (document_status_id, match_date_snapshot)`
    );
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_referee_accrual_documents_source_created_fk
       ON referee_accrual_documents (source_id, created_at)`
    );

    await queryInterface.sequelize.query(
      `ALTER TABLE referee_tariff_rules
       DROP COLUMN IF EXISTS status,
       DROP COLUMN IF EXISTS base_amount_kop,
       DROP COLUMN IF EXISTS meal_amount_kop`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE ground_referee_travel_rates
       DROP COLUMN IF EXISTS status,
       DROP COLUMN IF EXISTS travel_amount_kop`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE referee_accrual_documents
       DROP COLUMN IF EXISTS status,
       DROP COLUMN IF EXISTS source,
       DROP COLUMN IF EXISTS base_amount_kop,
       DROP COLUMN IF EXISTS meal_amount_kop,
       DROP COLUMN IF EXISTS travel_amount_kop,
       DROP COLUMN IF EXISTS total_amount_kop`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE referee_accrual_postings
       DROP COLUMN IF EXISTS posting_type,
       DROP COLUMN IF EXISTS component,
       DROP COLUMN IF EXISTS amount_kop`
    );
  },

  async down() {
    // Irreversible data migration from *_kop/string-enums to RUB/FK ref-data.
  },
};
