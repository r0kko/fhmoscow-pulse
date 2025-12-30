'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('referee_role_groups', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      name: { type: Sequelize.STRING(150), allowNull: false },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
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
    await queryInterface.addIndex('referee_role_groups', ['name'], {
      unique: true,
      name: 'uniq_referee_role_groups_name',
    });

    await queryInterface.createTable('referee_roles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      referee_role_group_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'referee_role_groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING(150), allowNull: false },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
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
    await queryInterface.addIndex('referee_roles', ['referee_role_group_id']);
    await queryInterface.addConstraint('referee_roles', {
      fields: ['referee_role_group_id', 'name'],
      type: 'unique',
      name: 'uniq_referee_roles_group_name',
    });

    await queryInterface.createTable('tournament_group_referees', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      tournament_group_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tournament_groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      referee_role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'referee_roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
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
    await queryInterface.addIndex('tournament_group_referees', [
      'tournament_group_id',
    ]);
    await queryInterface.addIndex('tournament_group_referees', [
      'referee_role_id',
    ]);
    await queryInterface.addConstraint('tournament_group_referees', {
      fields: ['tournament_group_id', 'referee_role_id'],
      type: 'unique',
      name: 'uniq_tournament_group_referee_role',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      'tournament_group_referees',
      'uniq_tournament_group_referee_role'
    );
    await queryInterface.removeIndex('tournament_group_referees', [
      'referee_role_id',
    ]);
    await queryInterface.removeIndex('tournament_group_referees', [
      'tournament_group_id',
    ]);
    await queryInterface.dropTable('tournament_group_referees');

    await queryInterface.removeConstraint(
      'referee_roles',
      'uniq_referee_roles_group_name'
    );
    await queryInterface.removeIndex('referee_roles', ['referee_role_group_id']);
    await queryInterface.dropTable('referee_roles');

    await queryInterface.removeIndex(
      'referee_role_groups',
      'uniq_referee_role_groups_name'
    );
    await queryInterface.dropTable('referee_role_groups');
  },
};
