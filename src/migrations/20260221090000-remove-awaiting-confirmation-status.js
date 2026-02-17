'use strict';

module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      `
      SELECT id, alias
      FROM user_statuses
      WHERE alias IN ('ACTIVE', 'AWAITING_CONFIRMATION', 'EMAIL_UNCONFIRMED')
      `
    );

    if (!Array.isArray(rows) || !rows.length) return;

    const statuses = new Map(
      rows.map((row) => [String(row.alias), String(row.id)])
    );
    const activeId = statuses.get('ACTIVE');
    const deprecatedAliases = ['AWAITING_CONFIRMATION', 'EMAIL_UNCONFIRMED'];
    const awaitingId = statuses.get('AWAITING_CONFIRMATION');
    const emailUnconfirmedId = statuses.get('EMAIL_UNCONFIRMED');

    for (const statusId of [awaitingId, emailUnconfirmedId]) {
      if (!activeId || !statusId) continue;
      await queryInterface.sequelize.query(
        `
        UPDATE users
        SET status_id = :activeId
        WHERE status_id = :statusId
        `,
        { replacements: { activeId, statusId } }
      );
    }

    for (const deprecatedAlias of deprecatedAliases) {
      await queryInterface.sequelize.query(
        'DELETE FROM user_statuses WHERE alias = :alias',
        { replacements: { alias: deprecatedAlias } }
      );
    }
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT id FROM user_statuses WHERE alias = 'ACTIVE' LIMIT 1
    `);
    if (!Array.isArray(rows) || !rows.length) return;

    await queryInterface.bulkInsert(
      'user_statuses',
      [
        {
          id: queryInterface.sequelize.literal('uuid_generate_v4()'),
          alias: 'AWAITING_CONFIRMATION',
          name: 'Awaiting confirmation',
          created_at: queryInterface.sequelize.literal('NOW()'),
          updated_at: queryInterface.sequelize.literal('NOW()'),
        },
        {
          id: queryInterface.sequelize.literal('uuid_generate_v4()'),
          alias: 'EMAIL_UNCONFIRMED',
          name: 'Email unconfirmed',
          created_at: queryInterface.sequelize.literal('NOW()'),
          updated_at: queryInterface.sequelize.literal('NOW()'),
        },
      ],
      { ignoreDuplicates: true }
    );
  },
};
