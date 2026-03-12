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

module.exports = {
  async up(queryInterface) {
    await upsertByAlias(queryInterface, 'referee_accrual_document_statuses', [
      {
        alias: 'DELETED',
        name_ru: 'Удалено',
        display_order: 30,
        is_terminal: true,
        allow_bulk: true,
        is_active: true,
      },
    ]);

    await upsertByAlias(queryInterface, 'referee_accrual_posting_types', [
      {
        alias: 'REVERSAL',
        name_ru: 'Сторно',
        display_order: 30,
        is_active: true,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE referee_accrual_document_statuses
          SET is_active = false,
              updated_at = NOW()
        WHERE alias = 'DELETED'`
    );
    await queryInterface.sequelize.query(
      `UPDATE referee_accrual_posting_types
          SET is_active = false,
              updated_at = NOW()
        WHERE alias = 'REVERSAL'`
    );
  },
};
