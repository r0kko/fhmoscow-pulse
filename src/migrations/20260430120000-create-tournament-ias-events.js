'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tournament_ias_events', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      tournament_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tournaments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ias_event_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'ias_events', key: 'id' },
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
    });

    await queryInterface.addConstraint('tournament_ias_events', {
      fields: ['tournament_id', 'ias_event_id'],
      type: 'unique',
      name: 'tournament_ias_events_tournament_event_unique',
    });
    await queryInterface.addIndex('tournament_ias_events', ['tournament_id'], {
      name: 'idx_tournament_ias_events_tournament_id',
    });
    await queryInterface.addIndex('tournament_ias_events', ['ias_event_id'], {
      name: 'idx_tournament_ias_events_ias_event_id',
    });

    const iasEventsTable = await queryInterface.describeTable('ias_events');
    if (iasEventsTable.tournament_id) {
      await queryInterface.sequelize.query(`
        INSERT INTO tournament_ias_events (
          id,
          tournament_id,
          ias_event_id,
          created_by,
          updated_by,
          created_at,
          updated_at
        )
        SELECT
          uuid_generate_v4(),
          tournament_id,
          id,
          created_by,
          updated_by,
          NOW(),
          NOW()
        FROM ias_events
        WHERE tournament_id IS NOT NULL
        ON CONFLICT (tournament_id, ias_event_id) DO NOTHING
      `);
      try {
        await queryInterface.removeIndex(
          'ias_events',
          'idx_ias_events_tournament_id'
        );
      } catch {
        // The index only exists in intermediate local builds of this feature.
      }
      await queryInterface.removeColumn('ias_events', 'tournament_id');
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tournament_ias_events');
  },
};
