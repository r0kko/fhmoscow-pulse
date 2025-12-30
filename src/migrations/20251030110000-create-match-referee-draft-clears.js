'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('match_referee_draft_clears', {
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
      referee_role_group_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'referee_role_groups', key: 'id' },
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

    await queryInterface.addConstraint('match_referee_draft_clears', {
      fields: ['match_id', 'referee_role_group_id'],
      type: 'unique',
      name: 'uniq_match_referee_draft_clear',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('match_referee_draft_clears');
  },
};
