'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('tickets', 'number', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // prettier-ignore
      await queryInterface.sequelize.query(
          'UPDATE tickets SET number = CONCAT(\'restored-\', id) WHERE number IS NULL',
          { transaction }
        );
      await queryInterface.changeColumn(
        'tickets',
        'number',
        { type: Sequelize.STRING, allowNull: false },
        { transaction }
      );
    });
  },
};
