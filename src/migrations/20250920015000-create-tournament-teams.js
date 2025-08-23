'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tournament_teams', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      external_id: { type: Sequelize.INTEGER, allowNull: false, unique: true },
      tournament_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'tournaments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tournament_group_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'tournament_groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      team_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'teams', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('tournament_teams', ['tournament_id']);
    await queryInterface.addIndex('tournament_teams', ['tournament_group_id']);
    await queryInterface.addIndex('tournament_teams', ['team_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tournament_teams', ['team_id']);
    await queryInterface.removeIndex('tournament_teams', [
      'tournament_group_id',
    ]);
    await queryInterface.removeIndex('tournament_teams', ['tournament_id']);
    await queryInterface.dropTable('tournament_teams');
  },
};
