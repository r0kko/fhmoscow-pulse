'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('normative_zones', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      season_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'seasons', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      name: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      alias: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      color: { type: Sequelize.STRING(20) },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      deleted_at: { type: Sequelize.DATE },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('normative_zones');
  },
};
