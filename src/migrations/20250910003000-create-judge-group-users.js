'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('judge_group_users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      group_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'judge_groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
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
    await queryInterface.addConstraint('judge_group_users', {
      fields: ['user_id'],
      type: 'unique',
      name: 'uq_judge_group_users_user',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('judge_group_users');
  },
};
