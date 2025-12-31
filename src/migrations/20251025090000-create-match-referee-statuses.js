'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('match_referee_statuses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      name: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      alias: { type: Sequelize.STRING(100), allowNull: false, unique: true },
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

    const now = new Date();
    const inserted = await queryInterface.bulkInsert(
      'match_referee_statuses',
      [
        {
          alias: 'DRAFT',
          name: 'Черновик',
          created_at: now,
          updated_at: now,
        },
        {
          alias: 'PUBLISHED',
          name: 'Опубликовано',
          created_at: now,
          updated_at: now,
        },
      ],
      { returning: true }
    );

    const resolveStatus = async (alias) => {
      if (Array.isArray(inserted)) {
        const found = inserted.find((status) => status.alias === alias);
        if (found) return found;
      }
      const [rows] = await queryInterface.sequelize.query(
        'SELECT id, alias FROM match_referee_statuses WHERE alias = :alias LIMIT 1',
        { replacements: { alias } }
      );
      return Array.isArray(rows) && rows.length ? rows[0] : null;
    };

    const draftStatus = await resolveStatus('DRAFT');
    const publishedStatus = await resolveStatus('PUBLISHED');
    if (!draftStatus || !publishedStatus) {
      throw new Error('Failed to resolve match referee statuses');
    }

    await queryInterface.addColumn('match_referees', 'status_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'match_referee_statuses', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.sequelize.query(`
      UPDATE match_referees mr
      SET status_id = s.id
      FROM match_referee_statuses s
      WHERE mr.status IS NOT NULL AND s.alias = mr.status
    `);
    await queryInterface.sequelize.query(`
      UPDATE match_referees
      SET status_id = '${draftStatus.id}'
      WHERE status_id IS NULL
    `);

    await queryInterface.changeColumn('match_referees', 'status_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'match_referee_statuses', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.removeConstraint(
      'match_referees',
      'uniq_match_referees_match_user_status'
    );
    await queryInterface.removeIndex('match_referees', ['match_id', 'status']);
    await queryInterface.removeIndex('match_referees', ['status']);
    await queryInterface.addIndex('match_referees', ['status_id']);
    await queryInterface.addIndex('match_referees', ['match_id', 'status_id']);
    await queryInterface.addConstraint('match_referees', {
      fields: ['match_id', 'user_id', 'status_id'],
      type: 'unique',
      name: 'uniq_match_referees_match_user_status',
    });

    await queryInterface.removeColumn('match_referees', 'status');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('match_referees', 'status', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE match_referees mr
      SET status = s.alias
      FROM match_referee_statuses s
      WHERE mr.status_id = s.id
    `);
    await queryInterface.sequelize.query(`
      UPDATE match_referees
      SET status = 'DRAFT'
      WHERE status IS NULL
    `);

    await queryInterface.changeColumn('match_referees', 'status', {
      type: Sequelize.STRING(20),
      allowNull: false,
    });

    await queryInterface.removeConstraint(
      'match_referees',
      'uniq_match_referees_match_user_status'
    );
    await queryInterface.removeIndex('match_referees', [
      'match_id',
      'status_id',
    ]);
    await queryInterface.removeIndex('match_referees', ['status_id']);
    await queryInterface.addIndex('match_referees', ['status']);
    await queryInterface.addIndex('match_referees', ['match_id', 'status']);
    await queryInterface.addConstraint('match_referees', {
      fields: ['match_id', 'user_id', 'status'],
      type: 'unique',
      name: 'uniq_match_referees_match_user_status',
    });

    await queryInterface.removeColumn('match_referees', 'status_id');
    await queryInterface.dropTable('match_referee_statuses');
  },
};
