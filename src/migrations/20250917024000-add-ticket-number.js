'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tickets', 'number', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.sequelize.query(`
      UPDATE tickets t
      SET number = numbers.number
      FROM (
        SELECT id,
               to_char(created_at, 'YYMM') || '-' ||
               lpad(row_number() OVER (PARTITION BY to_char(created_at, 'YYMM') ORDER BY created_at)::text, 6, '0') AS number
        FROM tickets
      ) numbers
      WHERE t.id = numbers.id;
    `);
    await queryInterface.changeColumn('tickets', 'number', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addIndex('tickets', ['number'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tickets', ['number']);
    await queryInterface.removeColumn('tickets', 'number');
  },
};
