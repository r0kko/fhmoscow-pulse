'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((table) => {
      if (typeof table === 'string') return table.toLowerCase();
      if (table && typeof table === 'object') {
        const name = table.tableName || table.name;
        return name ? String(name).toLowerCase() : '';
      }
      return '';
    });

    const hasStatusesTable = normalizedTables.includes(
      'player_photo_request_statuses'
    );
    const hasRequestsTable = normalizedTables.includes('player_photo_requests');

    if (!hasStatusesTable) {
      await queryInterface.createTable('player_photo_request_statuses', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.literal('uuid_generate_v4()'),
          primaryKey: true,
        },
        alias: {
          type: Sequelize.STRING(50),
          allowNull: false,
          unique: true,
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false,
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
    }

    const now = new Date();
    const statuses = await queryInterface.bulkInsert(
      'player_photo_request_statuses',
      [
        { alias: 'pending', name: 'На модерации', created_at: now, updated_at: now },
        { alias: 'approved', name: 'Подтверждено', created_at: now, updated_at: now },
        { alias: 'rejected', name: 'Отклонено', created_at: now, updated_at: now },
      ],
      { returning: true }
    );

    let pendingStatus = Array.isArray(statuses)
      ? statuses.find((status) => status.alias === 'pending')
      : null;
    if (!pendingStatus) {
      const [rows] = await queryInterface.sequelize.query(
        'SELECT id, alias FROM player_photo_request_statuses WHERE alias = \'pending\' LIMIT 1'
      );
      pendingStatus = Array.isArray(rows) && rows.length ? rows[0] : null;
    }
    if (!pendingStatus) {
      throw new Error('Failed to insert pending status for player photo requests');
    }

    if (!hasRequestsTable) {
      await queryInterface.createTable('player_photo_requests', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.literal('uuid_generate_v4()'),
          primaryKey: true,
        },
        player_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'players', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        file_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'files', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        status_id: {
          type: Sequelize.UUID,
          allowNull: false,
          defaultValue: pendingStatus.id,
          references: { model: 'player_photo_request_statuses', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        decision_reason: {
          type: Sequelize.TEXT,
        },
        reviewed_by: {
          type: Sequelize.UUID,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        reviewed_at: {
          type: Sequelize.DATE,
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
        deleted_at: {
          type: Sequelize.DATE,
        },
      });

      await queryInterface.addIndex('player_photo_requests', ['player_id']);
      await queryInterface.addIndex('player_photo_requests', ['status_id']);

      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX player_photo_requests_unique_pending
         ON player_photo_requests (player_id)
         WHERE deleted_at IS NULL AND status_id = '${pendingStatus.id}'::uuid;`
      );
    }
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS player_photo_requests_unique_pending;'
    );
    await queryInterface.dropTable('player_photo_requests');
    await queryInterface.dropTable('player_photo_request_statuses');
  },
};
