'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('trainings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      type_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'training_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      start_at: { type: Sequelize.DATE, allowNull: false },
      end_at: { type: Sequelize.DATE, allowNull: false },
      capacity: { type: Sequelize.INTEGER },
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('trainings');
  },
};
