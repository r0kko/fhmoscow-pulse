'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('match_agreements', {
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
      type_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'match_agreement_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      status_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'match_agreement_statuses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      author_user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      ground_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'grounds', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      date_start: { type: Sequelize.DATE, allowNull: false },
      parent_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'match_agreements', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      comment: { type: Sequelize.STRING(500), allowNull: true },
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

    await queryInterface.addIndex('match_agreements', ['match_id']);
    await queryInterface.addIndex('match_agreements', ['type_id']);
    await queryInterface.addIndex('match_agreements', ['status_id']);
    await queryInterface.addIndex('match_agreements', ['author_user_id']);
    await queryInterface.addIndex('match_agreements', ['ground_id']);
    await queryInterface.addIndex('match_agreements', ['parent_id']);
    await queryInterface.addIndex('match_agreements', ['date_start']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('match_agreements', ['date_start']);
    await queryInterface.removeIndex('match_agreements', ['parent_id']);
    await queryInterface.removeIndex('match_agreements', ['ground_id']);
    await queryInterface.removeIndex('match_agreements', ['author_user_id']);
    await queryInterface.removeIndex('match_agreements', ['status_id']);
    await queryInterface.removeIndex('match_agreements', ['type_id']);
    await queryInterface.removeIndex('match_agreements', ['match_id']);
    await queryInterface.dropTable('match_agreements');
  },
};
