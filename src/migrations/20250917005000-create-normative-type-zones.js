'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('normative_type_zones', {
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
      normative_type_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'normative_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      zone_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'normative_zones', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      min_value: { type: Sequelize.FLOAT },
      max_value: { type: Sequelize.FLOAT },
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
    await queryInterface.addIndex(
      'normative_type_zones',
      ['normative_type_id', 'zone_id'],
      {
        name: 'uq_normative_type_zone',
        unique: true,
        where: { deleted_at: null },
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('normative_type_zones');
  },
};
