'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('match_referees', {
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
      referee_role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'referee_roles', key: 'id' },
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
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      published_at: { type: Sequelize.DATE, allowNull: true },
      published_by: {
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' },
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

    await queryInterface.addIndex('match_referees', ['match_id']);
    await queryInterface.addIndex('match_referees', ['user_id']);
    await queryInterface.addIndex('match_referees', ['status']);
    await queryInterface.addIndex('match_referees', ['match_id', 'status']);
    await queryInterface.addConstraint('match_referees', {
      fields: ['match_id', 'user_id', 'status'],
      type: 'unique',
      name: 'uniq_match_referees_match_user_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      'match_referees',
      'uniq_match_referees_match_user_status'
    );
    await queryInterface.removeIndex('match_referees', ['match_id', 'status']);
    await queryInterface.removeIndex('match_referees', ['status']);
    await queryInterface.removeIndex('match_referees', ['user_id']);
    await queryInterface.removeIndex('match_referees', ['match_id']);
    await queryInterface.dropTable('match_referees');
  },
};
