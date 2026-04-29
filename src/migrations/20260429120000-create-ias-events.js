'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ias_events', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      registry_number: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      date_start: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      date_end: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      source: {
        type: Sequelize.STRING(64),
        allowNull: false,
        defaultValue: 'IAS',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addConstraint('ias_events', {
      fields: ['registry_number', 'name', 'date_start', 'date_end'],
      type: 'unique',
      name: 'ias_events_registry_name_dates_unique',
    });
    await queryInterface.addIndex('ias_events', ['registry_number'], {
      name: 'idx_ias_events_registry_number',
    });
    await queryInterface.addIndex('ias_events', ['date_start', 'date_end'], {
      name: 'idx_ias_events_dates',
    });
    await queryInterface.addIndex('ias_events', ['is_active'], {
      name: 'idx_ias_events_is_active',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ias_events');
  },
};
