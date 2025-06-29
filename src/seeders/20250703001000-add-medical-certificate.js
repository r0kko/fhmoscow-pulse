'use strict';
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const [user] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      `SELECT id FROM users WHERE email = 'aadrobot@fhmoscow.com' LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    if (!user) return;

    const [existing] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      `SELECT COUNT(*) AS cnt FROM medical_certificates WHERE user_id = :id;`,
      { replacements: { id: user.id }, type: Sequelize.QueryTypes.SELECT }
    );
    if (Number(existing.cnt) > 0) return;

    await queryInterface.bulkInsert('medical_certificates', [
      {
        id: uuidv4(),
        user_id: user.id,
        inn: '7707083893',
        organization: 'Городская поликлиника №1',
        certificate_number: 'MC-001',
        issue_date: '2024-01-10',
        valid_until: '2025-01-10',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('medical_certificates', null, {});
  },
};
