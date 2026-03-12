'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE referee_accounting_actions
          SET maker_checker_guard = false,
              updated_at = NOW()
        WHERE alias = 'APPROVE'
          AND scope = 'ACCRUAL'`
    );

    await queryInterface.sequelize.query(
      `INSERT INTO referee_accrual_number_counters (
         period_yyyymm,
         last_seq,
         created_at,
         updated_at
       )
       SELECT
         SUBSTRING(accrual_number FROM 4 FOR 6) AS period_yyyymm,
         MAX(CAST(RIGHT(accrual_number, 6) AS INTEGER)) AS last_seq,
         NOW(),
         NOW()
       FROM referee_accrual_documents
       WHERE accrual_number ~ '^RA-[0-9]{6}-[0-9]{6}$'
       GROUP BY SUBSTRING(accrual_number FROM 4 FOR 6)
       ON CONFLICT (period_yyyymm) DO UPDATE
       SET last_seq = GREATEST(
             referee_accrual_number_counters.last_seq,
             EXCLUDED.last_seq
           ),
           updated_at = NOW()`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE referee_accounting_actions
          SET maker_checker_guard = true,
              updated_at = NOW()
        WHERE alias = 'APPROVE'
          AND scope = 'ACCRUAL'`
    );
  },
};
