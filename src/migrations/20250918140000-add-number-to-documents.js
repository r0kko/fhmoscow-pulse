'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('documents');
    if (!table.number) {
      await queryInterface.addColumn('documents', 'number', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
    // Ensure unique constraint exists
    const [[constraintExists]] = await queryInterface.sequelize.query(
      // eslint-disable-next-line quotes
      "SELECT 1 FROM pg_constraint WHERE conname = 'documents_number_unique'"
    );
    if (!constraintExists) {
      await queryInterface.addConstraint('documents', {
        fields: ['number'],
        type: 'unique',
        name: 'documents_number_unique',
      });
    }
    await queryInterface.sequelize.query(
      'CREATE SEQUENCE IF NOT EXISTS documents_number_seq START WITH 1'
    );
    await queryInterface.sequelize.query(`
      WITH ordered AS (
        SELECT id, document_date,
               ROW_NUMBER() OVER (ORDER BY created_at) AS seq
        FROM documents
      )
      UPDATE documents d
      SET number = to_char(o.document_date, 'YY.MM') || '/' || o.seq::text
      FROM ordered o
      WHERE d.id = o.id
        AND d.number IS NULL;
    `);
    // Initialize sequence to the correct next value.
    // Use the max numeric suffix from existing numbers; if none, start at 1 (uncalled)
    await queryInterface.sequelize.query(`
      SELECT setval(
        'documents_number_seq',
        COALESCE(
          (SELECT MAX(split_part(number, '/', 2)::int)
             FROM documents
            WHERE number IS NOT NULL AND position('/' in number) > 0),
          1
        ),
        EXISTS(SELECT 1 FROM documents)
      )
    `);

    const tableAfter = await queryInterface.describeTable('documents');
    if (tableAfter.number) {
      await queryInterface.changeColumn('documents', 'number', {
        type: Sequelize.STRING(20),
        allowNull: false,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('documents');
    if (table.number) {
      await queryInterface.removeColumn('documents', 'number');
    }
    await queryInterface.sequelize.query(
      'DROP SEQUENCE IF EXISTS documents_number_seq'
    );
  },
};
