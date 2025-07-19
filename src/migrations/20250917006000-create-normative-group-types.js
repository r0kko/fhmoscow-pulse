'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('normative_group_types', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      group_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'normative_groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'normative_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_by: {
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
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
      'normative_group_types',
      ['group_id', 'type_id'],
      {
        name: 'uq_normative_group_type',
        unique: true,
        where: { deleted_at: null },
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('normative_group_types');
  },
};
