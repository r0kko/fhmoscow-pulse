'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('training_referee_groups', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      training_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'trainings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      group_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'referee_groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
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
    await queryInterface.addConstraint('training_referee_groups', {
      fields: ['training_id', 'group_id'],
      type: 'unique',
      name: 'uq_training_referee_group_training_group',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('training_referee_groups');
  },
};
