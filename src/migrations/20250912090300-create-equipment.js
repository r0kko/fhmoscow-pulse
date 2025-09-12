'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('equipment', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      type_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'equipment_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      manufacturer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'equipment_manufacturers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      size_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'equipment_sizes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      number: { type: Sequelize.INTEGER, allowNull: false },
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
    await queryInterface.addIndex('equipment', ['type_id']);
    await queryInterface.addIndex('equipment', ['manufacturer_id']);
    await queryInterface.addIndex('equipment', ['size_id']);
    await queryInterface.addIndex('equipment', ['number']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('equipment');
  },
};
