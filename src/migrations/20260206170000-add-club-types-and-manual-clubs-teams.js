'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('club_types', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      alias: { type: Sequelize.STRING(64), allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
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

    await queryInterface.addIndex('club_types', ['alias'], {
      unique: true,
      name: 'uniq_club_types_alias',
    });

    const now = new Date();
    const youthId = randomUUID();
    const proId = randomUUID();
    await queryInterface.bulkInsert('club_types', [
      {
        id: youthId,
        alias: 'YOUTH',
        name: 'Детско-юношеский',
        created_at: now,
        updated_at: now,
      },
      {
        id: proId,
        alias: 'PRO',
        name: 'Профессиональный',
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.addColumn('clubs', 'club_type_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'club_types', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    await queryInterface.sequelize.query(
      `
      UPDATE clubs
      SET club_type_id = :youthId
      WHERE club_type_id IS NULL
      `,
      { replacements: { youthId } }
    );
    await queryInterface.changeColumn('clubs', 'club_type_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'club_types', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    await queryInterface.addIndex('clubs', ['club_type_id'], {
      name: 'idx_clubs_club_type_id',
    });

    await queryInterface.changeColumn('clubs', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.changeColumn('teams', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      WITH cte AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS rn
        FROM teams
        WHERE external_id IS NULL
      )
      UPDATE teams t
      SET external_id = -6000000 - cte.rn
      FROM cte
      WHERE t.id = cte.id
    `);

    await queryInterface.sequelize.query(`
      WITH cte AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS rn
        FROM clubs
        WHERE external_id IS NULL
      )
      UPDATE clubs c
      SET external_id = -7000000 - cte.rn
      FROM cte
      WHERE c.id = cte.id
    `);

    await queryInterface.changeColumn('teams', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
    await queryInterface.changeColumn('clubs', 'external_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    await queryInterface.removeIndex('clubs', 'idx_clubs_club_type_id');
    await queryInterface.removeColumn('clubs', 'club_type_id');

    await queryInterface.removeIndex('club_types', 'uniq_club_types_alias');
    await queryInterface.dropTable('club_types');
  },
};
