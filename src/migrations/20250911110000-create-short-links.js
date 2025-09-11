/* eslint-env node */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('short_links', {
      code: {
        type: Sequelize.STRING(32),
        allowNull: false,
        primaryKey: true,
      },
      token: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      hits: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addIndex('short_links', ['code'], { unique: true });
    await queryInterface.addIndex('short_links', ['token'], { unique: true });
    await queryInterface.addIndex('short_links', ['expires_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('short_links');
  },
};
