'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('match_staff', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      match_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'matches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      team_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'teams', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      team_staff_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'team_staff', key: 'id' },
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
    await queryInterface.addIndex('match_staff', ['match_id']);
    await queryInterface.addIndex('match_staff', ['team_id']);
    await queryInterface.addIndex('match_staff', ['team_staff_id']);
    await queryInterface.addConstraint('match_staff', {
      fields: ['match_id', 'team_staff_id'],
      type: 'unique',
      name: 'uniq_match_team_staff',
    });
    await queryInterface.addConstraint('match_staff', {
      fields: ['match_id', 'team_id', 'team_staff_id'],
      type: 'unique',
      name: 'uniq_match_team_team_staff',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeConstraint(
      'match_staff',
      'uniq_match_team_team_staff'
    );
    await queryInterface.removeConstraint(
      'match_staff',
      'uniq_match_team_staff'
    );
    await queryInterface.removeIndex('match_staff', ['team_staff_id']);
    await queryInterface.removeIndex('match_staff', ['team_id']);
    await queryInterface.removeIndex('match_staff', ['match_id']);
    await queryInterface.dropTable('match_staff');
  },
};
