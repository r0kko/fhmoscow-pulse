'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('match_referee_notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      match_referee_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'match_referees', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: { type: Sequelize.STRING(40), allowNull: false },
      channel: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'EMAIL',
      },
      payload_hash: { type: Sequelize.STRING(64), allowNull: false },
      payload: { type: Sequelize.JSONB, allowNull: true },
      sent_at: { type: Sequelize.DATE, allowNull: true },
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

    await queryInterface.addIndex('match_referee_notifications', [
      'match_referee_id',
    ]);
    await queryInterface.addIndex('match_referee_notifications', ['user_id']);
    await queryInterface.addIndex('match_referee_notifications', ['type']);
    await queryInterface.addIndex('match_referee_notifications', ['sent_at']);
    await queryInterface.addConstraint('match_referee_notifications', {
      fields: ['payload_hash'],
      type: 'unique',
      name: 'uniq_match_referee_notifications_payload_hash',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      'match_referee_notifications',
      'uniq_match_referee_notifications_payload_hash'
    );
    await queryInterface.removeIndex('match_referee_notifications', [
      'sent_at',
    ]);
    await queryInterface.removeIndex('match_referee_notifications', ['type']);
    await queryInterface.removeIndex('match_referee_notifications', [
      'user_id',
    ]);
    await queryInterface.removeIndex('match_referee_notifications', [
      'match_referee_id',
    ]);
    await queryInterface.dropTable('match_referee_notifications');
  },
};
