'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('matches', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      external_id: { type: Sequelize.INTEGER, allowNull: false, unique: true },
      date_start: { type: Sequelize.DATE },
      tournament_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'tournaments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      stage_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'stages', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      tournament_group_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'tournament_groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      tour_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'tours', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      ground_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'grounds', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      team1_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'teams', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      team2_id: {
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

    await queryInterface.addIndex('matches', ['date_start']);
    await queryInterface.addIndex('matches', ['tournament_id']);
    await queryInterface.addIndex('matches', ['stage_id']);
    await queryInterface.addIndex('matches', ['tournament_group_id']);
    await queryInterface.addIndex('matches', ['tour_id']);
    await queryInterface.addIndex('matches', ['ground_id']);
    await queryInterface.addIndex('matches', ['team1_id']);
    await queryInterface.addIndex('matches', ['team2_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('matches', ['team2_id']);
    await queryInterface.removeIndex('matches', ['team1_id']);
    await queryInterface.removeIndex('matches', ['ground_id']);
    await queryInterface.removeIndex('matches', ['tour_id']);
    await queryInterface.removeIndex('matches', ['tournament_group_id']);
    await queryInterface.removeIndex('matches', ['stage_id']);
    await queryInterface.removeIndex('matches', ['tournament_id']);
    await queryInterface.removeIndex('matches', ['date_start']);
    await queryInterface.dropTable('matches');
  },
};
