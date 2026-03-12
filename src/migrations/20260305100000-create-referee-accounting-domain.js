'use strict';

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function indexExists(queryInterface, indexName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1
       FROM pg_class
      WHERE relkind = 'i'
        AND relname = :name
      LIMIT 1`,
    {
      replacements: { name: indexName },
    }
  );

  return Boolean(rows?.length);
}

async function constraintExists(queryInterface, constraintName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1
       FROM pg_constraint
      WHERE conname = :name
      LIMIT 1`,
    {
      replacements: { name: constraintName },
    }
  );

  return Boolean(rows?.length);
}

async function ensureLookupTable(
  queryInterface,
  Sequelize,
  tableName,
  extraColumns = {}
) {
  if (await tableExists(queryInterface, tableName)) {
    return;
  }

  await queryInterface.createTable(tableName, {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.literal('uuid_generate_v4()'),
      primaryKey: true,
    },
    alias: {
      type: Sequelize.STRING(32),
      allowNull: false,
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
    ...extraColumns,
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

async function ensureIndex(queryInterface, tableName, fields, options) {
  if (options?.name && (await indexExists(queryInterface, options.name))) {
    return;
  }

  await queryInterface.addIndex(tableName, fields, options);
}

async function ensureConstraint(queryInterface, tableName, options) {
  if (options?.name && (await constraintExists(queryInterface, options.name))) {
    return;
  }

  await queryInterface.addConstraint(tableName, options);
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

async function upsertTransitions(queryInterface, rows) {
  for (const row of rows) {
    if (!row.from_status_id || !row.action_id || !row.to_status_id) {
      continue;
    }

    await queryInterface.sequelize.query(
      `UPDATE referee_accrual_status_transitions
          SET to_status_id = :to_status_id,
              is_enabled = :is_enabled,
              updated_at = NOW()
        WHERE from_status_id = :from_status_id
          AND action_id = :action_id
          AND deleted_at IS NULL`,
      {
        replacements: row,
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
        replacements: row,
      }
    );

    if (existingRows?.length) {
      continue;
    }

    await queryInterface.sequelize.query(
      `INSERT INTO referee_accrual_status_transitions (
         from_status_id,
         action_id,
         to_status_id,
         is_enabled,
         created_at,
         updated_at
       )
       VALUES (
         :from_status_id,
         :action_id,
         :to_status_id,
         :is_enabled,
         NOW(),
         NOW()
       )`,
      {
        replacements: row,
      }
    );
  }
}

async function dropTableIfExists(queryInterface, tableName) {
  if (await tableExists(queryInterface, tableName)) {
    await queryInterface.dropTable(tableName);
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = Sequelize.literal('NOW()');
    await ensureLookupTable(
      queryInterface,
      Sequelize,
      'referee_tariff_statuses'
    );
    await ensureIndex(queryInterface, 'referee_tariff_statuses', ['alias'], {
      name: 'uq_referee_tariff_statuses_alias',
      unique: true,
    });

    await ensureLookupTable(
      queryInterface,
      Sequelize,
      'ground_travel_rate_statuses'
    );
    await ensureIndex(
      queryInterface,
      'ground_travel_rate_statuses',
      ['alias'],
      {
        name: 'uq_ground_travel_rate_statuses_alias',
        unique: true,
      }
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
    await ensureIndex(
      queryInterface,
      'referee_accrual_document_statuses',
      ['alias'],
      {
        name: 'uq_referee_accrual_document_statuses_alias',
        unique: true,
      }
    );

    await ensureLookupTable(
      queryInterface,
      Sequelize,
      'referee_accrual_sources'
    );
    await ensureIndex(queryInterface, 'referee_accrual_sources', ['alias'], {
      name: 'uq_referee_accrual_sources_alias',
      unique: true,
    });

    await ensureLookupTable(
      queryInterface,
      Sequelize,
      'referee_accrual_posting_types'
    );
    await ensureIndex(
      queryInterface,
      'referee_accrual_posting_types',
      ['alias'],
      {
        name: 'uq_referee_accrual_posting_types_alias',
        unique: true,
      }
    );

    await ensureLookupTable(
      queryInterface,
      Sequelize,
      'referee_accrual_components'
    );
    await ensureIndex(queryInterface, 'referee_accrual_components', ['alias'], {
      name: 'uq_referee_accrual_components_alias',
      unique: true,
    });

    if (!(await tableExists(queryInterface, 'referee_accounting_actions'))) {
      await queryInterface.createTable('referee_accounting_actions', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.literal('uuid_generate_v4()'),
          primaryKey: true,
        },
        alias: {
          type: Sequelize.STRING(32),
          allowNull: false,
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
        scope: {
          type: Sequelize.STRING(16),
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
          defaultValue: now,
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: now,
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });
    }

    await ensureIndex(queryInterface, 'referee_accounting_actions', ['alias'], {
      name: 'uq_referee_accounting_actions_alias',
      unique: true,
    });
    await ensureIndex(
      queryInterface,
      'referee_accounting_actions',
      ['scope', 'display_order'],
      {
        name: 'idx_referee_accounting_actions_scope_order',
      }
    );

    await upsertByAlias(queryInterface, 'referee_tariff_statuses', [
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

    await upsertByAlias(queryInterface, 'ground_travel_rate_statuses', [
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

    await upsertByAlias(queryInterface, 'referee_accrual_sources', [
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

    await upsertByAlias(queryInterface, 'referee_accrual_posting_types', [
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

    await upsertByAlias(queryInterface, 'referee_accrual_components', [
      {
        alias: 'BASE',
        name_ru: 'База',
        display_order: 10,
        is_active: true,
      },
      {
        alias: 'MEAL',
        name_ru: 'Питание',
        display_order: 20,
        is_active: true,
      },
      {
        alias: 'TRAVEL',
        name_ru: 'Проезд',
        display_order: 30,
        is_active: true,
      },
    ]);

    await upsertByAlias(queryInterface, 'referee_accounting_actions', [
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

    const selectIdByAlias = async (tableName, alias) => {
      const rows = await queryInterface.sequelize.query(
        `SELECT id FROM ${tableName} WHERE alias = :alias AND deleted_at IS NULL LIMIT 1`,
        {
          replacements: { alias },
          type: Sequelize.QueryTypes.SELECT,
        }
      );
      return rows?.[0]?.id || null;
    };

    const statusDraftId = await selectIdByAlias(
      'referee_accrual_document_statuses',
      'DRAFT'
    );
    const statusReviewedId = await selectIdByAlias(
      'referee_accrual_document_statuses',
      'REVIEWED'
    );
    const statusApprovedId = await selectIdByAlias(
      'referee_accrual_document_statuses',
      'APPROVED'
    );
    const statusPostedId = await selectIdByAlias(
      'referee_accrual_document_statuses',
      'POSTED'
    );
    const statusVoidId = await selectIdByAlias(
      'referee_accrual_document_statuses',
      'VOID'
    );

    const actionReviewId = await selectIdByAlias(
      'referee_accounting_actions',
      'REVIEW'
    );
    const actionApproveId = await selectIdByAlias(
      'referee_accounting_actions',
      'APPROVE'
    );
    const actionPostId = await selectIdByAlias(
      'referee_accounting_actions',
      'POST'
    );
    const actionVoidId = await selectIdByAlias(
      'referee_accounting_actions',
      'VOID'
    );

    if (
      !(await tableExists(queryInterface, 'referee_accrual_status_transitions'))
    ) {
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
          defaultValue: now,
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: now,
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });
    }

    await ensureIndex(
      queryInterface,
      'referee_accrual_status_transitions',
      ['from_status_id', 'action_id'],
      {
        name: 'uq_referee_accrual_status_transitions_from_action',
        unique: true,
      }
    );

    await upsertTransitions(queryInterface, [
      {
        from_status_id: statusDraftId,
        action_id: actionReviewId,
        to_status_id: statusReviewedId,
        is_enabled: true,
      },
      {
        from_status_id: statusDraftId,
        action_id: actionApproveId,
        to_status_id: statusApprovedId,
        is_enabled: true,
      },
      {
        from_status_id: statusDraftId,
        action_id: actionVoidId,
        to_status_id: statusVoidId,
        is_enabled: true,
      },
      {
        from_status_id: statusReviewedId,
        action_id: actionApproveId,
        to_status_id: statusApprovedId,
        is_enabled: true,
      },
      {
        from_status_id: statusReviewedId,
        action_id: actionVoidId,
        to_status_id: statusVoidId,
        is_enabled: true,
      },
      {
        from_status_id: statusApprovedId,
        action_id: actionPostId,
        to_status_id: statusPostedId,
        is_enabled: true,
      },
      {
        from_status_id: statusApprovedId,
        action_id: actionVoidId,
        to_status_id: statusVoidId,
        is_enabled: true,
      },
      {
        from_status_id: statusPostedId,
        action_id: actionVoidId,
        to_status_id: statusVoidId,
        is_enabled: true,
      },
    ]);

    if (!(await tableExists(queryInterface, 'referee_tariff_rules'))) {
      await queryInterface.createTable('referee_tariff_rules', {
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
        },
        stage_group_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'tournament_groups', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        referee_role_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'referee_roles', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        fare_code: {
          type: Sequelize.STRING(8),
          allowNull: false,
        },
        base_amount_rub: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: '0.00',
        },
        meal_amount_rub: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: '0.00',
        },
        travel_mode: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'ARENA_FIXED',
        },
        valid_from: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        valid_to: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        tariff_status_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'referee_tariff_statuses', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        version: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        filed_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        approved_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
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
          defaultValue: now,
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: now,
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });
    }

    await ensureIndex(
      queryInterface,
      'referee_tariff_rules',
      [
        'tournament_id',
        'stage_group_id',
        'referee_role_id',
        'tariff_status_id',
      ],
      { name: 'idx_referee_tariff_rules_scope_status' }
    );
    await ensureIndex(
      queryInterface,
      'referee_tariff_rules',
      ['valid_from', 'valid_to'],
      { name: 'idx_referee_tariff_rules_validity' }
    );
    await ensureConstraint(queryInterface, 'referee_tariff_rules', {
      fields: ['base_amount_rub'],
      type: 'check',
      name: 'chk_referee_tariff_rules_base_amount_rub_non_negative',
      where: {
        base_amount_rub: {
          [Sequelize.Op.gte]: 0,
        },
      },
    });
    await ensureConstraint(queryInterface, 'referee_tariff_rules', {
      fields: ['meal_amount_rub'],
      type: 'check',
      name: 'chk_referee_tariff_rules_meal_amount_rub_non_negative',
      where: {
        meal_amount_rub: {
          [Sequelize.Op.gte]: 0,
        },
      },
    });

    if (!(await tableExists(queryInterface, 'ground_referee_travel_rates'))) {
      await queryInterface.createTable('ground_referee_travel_rates', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.literal('uuid_generate_v4()'),
          primaryKey: true,
        },
        ground_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'grounds', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        rate_code: {
          type: Sequelize.STRING(16),
          allowNull: true,
        },
        travel_amount_rub: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: '0.00',
        },
        valid_from: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        valid_to: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        travel_rate_status_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'ground_travel_rate_statuses', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
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
          defaultValue: now,
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: now,
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });
    }

    await ensureIndex(
      queryInterface,
      'ground_referee_travel_rates',
      ['ground_id', 'travel_rate_status_id'],
      { name: 'idx_ground_referee_travel_rates_scope_status' }
    );
    await ensureIndex(
      queryInterface,
      'ground_referee_travel_rates',
      ['valid_from', 'valid_to'],
      { name: 'idx_ground_referee_travel_rates_validity' }
    );
    await ensureConstraint(queryInterface, 'ground_referee_travel_rates', {
      fields: ['travel_amount_rub'],
      type: 'check',
      name: 'chk_ground_referee_travel_rates_amount_rub_non_negative',
      where: {
        travel_amount_rub: {
          [Sequelize.Op.gte]: 0,
        },
      },
    });

    if (!(await tableExists(queryInterface, 'referee_accrual_documents'))) {
      await queryInterface.createTable('referee_accrual_documents', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.literal('uuid_generate_v4()'),
          primaryKey: true,
        },
        accrual_number: {
          type: Sequelize.STRING(24),
          allowNull: false,
        },
        tournament_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'tournaments', key: 'id' },
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
        match_referee_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'match_referees', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        referee_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        referee_role_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'referee_roles', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        stage_group_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'tournament_groups', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        ground_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'grounds', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        fare_code_snapshot: {
          type: Sequelize.STRING(8),
          allowNull: false,
        },
        tariff_rule_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'referee_tariff_rules', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        travel_rate_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'ground_referee_travel_rates', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        match_date_snapshot: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        base_amount_rub: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
        },
        meal_amount_rub: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
        },
        travel_amount_rub: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
        },
        total_amount_rub: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
        },
        currency: {
          type: Sequelize.STRING(3),
          allowNull: false,
          defaultValue: 'RUB',
        },
        document_status_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'referee_accrual_document_statuses', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        source_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'referee_accrual_sources', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        calc_fingerprint: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        original_document_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'referee_accrual_documents', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        reviewed_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        approved_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        posted_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
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
          defaultValue: now,
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: now,
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });
    }

    await ensureIndex(
      queryInterface,
      'referee_accrual_documents',
      ['accrual_number'],
      {
        name: 'uq_referee_accrual_documents_number',
        unique: true,
      }
    );
    await ensureIndex(
      queryInterface,
      'referee_accrual_documents',
      ['match_referee_id'],
      {
        name: 'uq_referee_accrual_documents_original_match_referee',
        unique: true,
        where: { original_document_id: null, deleted_at: null },
      }
    );
    await ensureIndex(
      queryInterface,
      'referee_accrual_documents',
      ['calc_fingerprint'],
      {
        name: 'uq_referee_accrual_documents_original_fingerprint',
        unique: true,
        where: { original_document_id: null, deleted_at: null },
      }
    );
    await ensureIndex(
      queryInterface,
      'referee_accrual_documents',
      ['document_status_id', 'match_date_snapshot'],
      { name: 'idx_referee_accrual_documents_status_date' }
    );
    await ensureIndex(
      queryInterface,
      'referee_accrual_documents',
      ['source_id', 'created_at'],
      { name: 'idx_referee_accrual_documents_source_created' }
    );
    await ensureIndex(
      queryInterface,
      'referee_accrual_documents',
      ['fare_code_snapshot', 'match_date_snapshot'],
      { name: 'idx_referee_accrual_documents_fare_date' }
    );

    if (!(await tableExists(queryInterface, 'referee_accrual_postings'))) {
      await queryInterface.createTable('referee_accrual_postings', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.literal('uuid_generate_v4()'),
          primaryKey: true,
        },
        document_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'referee_accrual_documents', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        line_no: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        posting_type_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'referee_accrual_posting_types', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        component_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'referee_accrual_components', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        amount_rub: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
        },
        reason_code: {
          type: Sequelize.STRING(64),
          allowNull: true,
        },
        comment: {
          type: Sequelize.TEXT,
          allowNull: true,
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
          defaultValue: now,
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: now,
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });
    }

    await ensureIndex(
      queryInterface,
      'referee_accrual_postings',
      ['document_id'],
      {
        name: 'idx_referee_accrual_postings_document_id',
      }
    );
    await ensureIndex(
      queryInterface,
      'referee_accrual_postings',
      ['document_id', 'line_no'],
      {
        name: 'uq_referee_accrual_postings_document_line',
        unique: true,
        where: { deleted_at: null },
      }
    );

    if (!(await tableExists(queryInterface, 'accounting_audit_events'))) {
      await queryInterface.createTable('accounting_audit_events', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.literal('uuid_generate_v4()'),
          primaryKey: true,
        },
        entity_type: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        entity_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        action: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        before_json: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        after_json: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        actor_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
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
          defaultValue: now,
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: now,
        },
      });
    }

    await ensureIndex(
      queryInterface,
      'accounting_audit_events',
      ['entity_type', 'entity_id', 'created_at'],
      { name: 'idx_accounting_audit_events_entity' }
    );
  },

  async down(queryInterface) {
    await dropTableIfExists(queryInterface, 'accounting_audit_events');
    await dropTableIfExists(queryInterface, 'referee_accrual_postings');
    await dropTableIfExists(queryInterface, 'referee_accrual_documents');
    await dropTableIfExists(queryInterface, 'ground_referee_travel_rates');
    await dropTableIfExists(queryInterface, 'referee_tariff_rules');
    await dropTableIfExists(
      queryInterface,
      'referee_accrual_status_transitions'
    );
    await dropTableIfExists(queryInterface, 'referee_accounting_actions');
    await dropTableIfExists(queryInterface, 'referee_accrual_components');
    await dropTableIfExists(queryInterface, 'referee_accrual_posting_types');
    await dropTableIfExists(queryInterface, 'referee_accrual_sources');
    await dropTableIfExists(
      queryInterface,
      'referee_accrual_document_statuses'
    );
    await dropTableIfExists(queryInterface, 'ground_travel_rate_statuses');
    await dropTableIfExists(queryInterface, 'referee_tariff_statuses');
  },
};
