'use strict';

module.exports = {
  up: async (queryInterface, _Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `CREATE TABLE IF NOT EXISTS player_photo_request_statuses (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          alias VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        )`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `INSERT INTO player_photo_request_statuses (alias, name, created_at, updated_at)
         VALUES
           ('pending', 'На модерации', NOW(), NOW()),
           ('approved', 'Подтверждено', NOW(), NOW()),
           ('rejected', 'Отклонено', NOW(), NOW())
         ON CONFLICT (alias) DO UPDATE SET
           name = EXCLUDED.name,
           updated_at = NOW()`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        'ALTER TABLE player_photo_request_statuses ADD COLUMN IF NOT EXISTS created_by UUID',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE player_photo_request_statuses ADD COLUMN IF NOT EXISTS updated_by UUID',
        { transaction }
      );
      await queryInterface.sequelize.query(
        `DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'player_photo_request_statuses_created_by_fkey'
          ) THEN
            ALTER TABLE player_photo_request_statuses
              ADD CONSTRAINT player_photo_request_statuses_created_by_fkey
              FOREIGN KEY (created_by) REFERENCES users(id)
              ON UPDATE CASCADE ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'player_photo_request_statuses_updated_by_fkey'
          ) THEN
            ALTER TABLE player_photo_request_statuses
              ADD CONSTRAINT player_photo_request_statuses_updated_by_fkey
              FOREIGN KEY (updated_by) REFERENCES users(id)
              ON UPDATE CASCADE ON DELETE SET NULL;
          END IF;
        END
        $$;`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        'ALTER TABLE player_photo_requests ADD COLUMN IF NOT EXISTS status_id UUID',
        { transaction }
      );

      const [[pendingRow]] = await queryInterface.sequelize.query(
        'SELECT id FROM player_photo_request_statuses WHERE alias = \'pending\' LIMIT 1',
        { transaction }
      );
      const pendingId = pendingRow?.id;
      if (!pendingId) {
        throw new Error('Failed to resolve pending status id');
      }

      const [columns] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns
           WHERE table_name = 'player_photo_requests' AND column_name = 'status'`,
        { transaction }
      );
      const hasLegacyStatus = Array.isArray(columns) && columns.length > 0;

      if (hasLegacyStatus) {
        await queryInterface.sequelize.query(
          `UPDATE player_photo_requests ppr
             SET status_id = status_map.id
             FROM (
               SELECT id, alias FROM player_photo_request_statuses
             ) status_map
            WHERE ppr.status_id IS NULL AND status_map.alias = ppr.status::text`,
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        `UPDATE player_photo_requests
            SET status_id = :pendingId
          WHERE status_id IS NULL`,
        { transaction, replacements: { pendingId } }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE player_photo_requests
           ALTER COLUMN status_id SET NOT NULL`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        'ALTER TABLE player_photo_requests DROP CONSTRAINT IF EXISTS player_photo_requests_status_fk',
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE player_photo_requests
           ADD CONSTRAINT player_photo_requests_status_fk
           FOREIGN KEY (status_id)
           REFERENCES player_photo_request_statuses(id)
           ON UPDATE CASCADE
           ON DELETE RESTRICT`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS player_photo_requests_unique_pending',
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX player_photo_requests_unique_pending
           ON player_photo_requests (player_id)
         WHERE deleted_at IS NULL AND status_id = CAST(:pendingId AS UUID)`,
        { transaction, replacements: { pendingId } }
      );

      if (hasLegacyStatus) {
        await queryInterface.sequelize.query(
          'ALTER TABLE player_photo_requests DROP COLUMN IF EXISTS status',
          { transaction }
        );
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS enum_player_photo_requests_status',
          { transaction }
        );
      }
    });
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [columns] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns
           WHERE table_name = 'player_photo_requests' AND column_name = 'status'`,
        { transaction }
      );
      const hasLegacyStatus = Array.isArray(columns) && columns.length > 0;

      if (!hasLegacyStatus) {
        await queryInterface.sequelize.query(
          'CREATE TYPE enum_player_photo_requests_status AS ENUM (\'pending\', \'approved\', \'rejected\')',
          { transaction }
        );
        await queryInterface.sequelize.query(
          'ALTER TABLE player_photo_requests ADD COLUMN status enum_player_photo_requests_status',
          { transaction }
        );
        await queryInterface.sequelize.query(
          `UPDATE player_photo_requests ppr
             SET status = status_map.alias::enum_player_photo_requests_status
             FROM (
               SELECT id, alias FROM player_photo_request_statuses
             ) status_map
            WHERE status_map.id = ppr.status_id`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          'ALTER TABLE player_photo_requests ALTER COLUMN status SET NOT NULL',
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS player_photo_requests_unique_pending',
        { transaction }
      );

      if (!hasLegacyStatus) {
        await queryInterface.sequelize.query(
          'ALTER TABLE player_photo_requests DROP COLUMN status_id',
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        'ALTER TABLE player_photo_requests DROP CONSTRAINT IF EXISTS player_photo_requests_status_fk',
        { transaction }
      );

      await queryInterface.sequelize.query(
        'DROP TABLE IF EXISTS player_photo_request_statuses',
        { transaction }
      );

      if (!hasLegacyStatus) {
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS enum_player_photo_requests_status',
          { transaction }
        );
      }
    });
  },
};
