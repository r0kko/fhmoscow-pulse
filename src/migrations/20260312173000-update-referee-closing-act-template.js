'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'referee_closing_documents',
      'contract_snapshot_json',
      {
        type: Sequelize.JSONB,
        allowNull: true,
      }
    );

    await queryInterface.sequelize.query(
      `UPDATE document_types
          SET name = 'Акт об оказании услуг',
              updated_at = NOW()
        WHERE alias = 'REFEREE_CLOSING_ACT'
          AND deleted_at IS NULL`
    );

    await queryInterface.sequelize.query(
      `UPDATE documents
          SET name = 'Акт об оказании услуг',
              updated_at = NOW()
        WHERE document_type_id IN (
          SELECT id
            FROM document_types
           WHERE alias = 'REFEREE_CLOSING_ACT'
             AND deleted_at IS NULL
        )
          AND deleted_at IS NULL`
    );
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.removeColumn(
      'referee_closing_documents',
      'contract_snapshot_json'
    );

    await queryInterface.sequelize.query(
      `UPDATE document_types
          SET name = 'Акт выполненных работ',
              updated_at = NOW()
        WHERE alias = 'REFEREE_CLOSING_ACT'
          AND deleted_at IS NULL`
    );

    await queryInterface.sequelize.query(
      `UPDATE documents
          SET name = 'Акт выполненных работ',
              updated_at = NOW()
        WHERE document_type_id IN (
          SELECT id
            FROM document_types
           WHERE alias = 'REFEREE_CLOSING_ACT'
             AND deleted_at IS NULL
        )
          AND deleted_at IS NULL`
    );
  },
};
