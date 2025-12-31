'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('schedule_management_types', {
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
    await queryInterface.addIndex('schedule_management_types', ['alias'], {
      unique: true,
      name: 'uniq_schedule_management_types_alias',
    });

    await queryInterface.bulkInsert('schedule_management_types', [
      {
        alias: 'PARTICIPANTS',
        name: 'Согласование времени между участниками',
        created_at: Sequelize.literal('NOW()'),
        updated_at: Sequelize.literal('NOW()'),
      },
      {
        alias: 'ORGANIZER',
        name: 'Управление организатором',
        created_at: Sequelize.literal('NOW()'),
        updated_at: Sequelize.literal('NOW()'),
      },
    ]);

    await queryInterface.addColumn(
      'tournaments',
      'schedule_management_type_id',
      {
        type: Sequelize.UUID,
        references: { model: 'schedule_management_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        allowNull: true,
      }
    );
    await queryInterface.addIndex(
      'tournaments',
      ['schedule_management_type_id'],
      {
        name: 'idx_tournaments_schedule_management_type_id',
      }
    );

    await queryInterface.sequelize.query(`
      UPDATE tournaments
      SET schedule_management_type_id = (
        SELECT id
        FROM schedule_management_types
        WHERE alias = 'PARTICIPANTS'
        LIMIT 1
      )
      WHERE schedule_management_type_id IS NULL
    `);

    await queryInterface.changeColumn(
      'tournaments',
      'schedule_management_type_id',
      {
        type: Sequelize.UUID,
        references: { model: 'schedule_management_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        allowNull: false,
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'tournaments',
      'idx_tournaments_schedule_management_type_id'
    );
    await queryInterface.removeColumn(
      'tournaments',
      'schedule_management_type_id'
    );
    await queryInterface.removeIndex(
      'schedule_management_types',
      'uniq_schedule_management_types_alias'
    );
    await queryInterface.dropTable('schedule_management_types');
  },
};
