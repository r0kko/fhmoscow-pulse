'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('trainings', 'status_id');
    await queryInterface.dropTable('training_statuses');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('training_statuses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      name: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      alias: { type: Sequelize.STRING(100), allowNull: false, unique: true },
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
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      deleted_at: { type: Sequelize.DATE },
    });
    await queryInterface.addColumn('trainings', 'status_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'training_statuses', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },
};
