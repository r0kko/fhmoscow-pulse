'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('documents', 'number', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
    await queryInterface.addConstraint('documents', {
      fields: ['number'],
      type: 'unique',
      name: 'documents_number_unique',
    });
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
      SET number =
        to_char(o.document_date, 'YY.MM') || '/' || LPAD(o.seq::text, 6, '0')
      FROM ordered o
      WHERE d.id = o.id;
    `);
    await queryInterface.sequelize.query(
      // eslint-disable-next-line quotes
      "SELECT setval('documents_number_seq', (SELECT COUNT(*) FROM documents))"
    );
    await queryInterface.changeColumn('documents', 'number', {
      type: Sequelize.STRING(20),
      allowNull: false,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('documents', 'number');
    await queryInterface.sequelize.query(
      'DROP SEQUENCE IF EXISTS documents_number_seq'
    );
  },
};
