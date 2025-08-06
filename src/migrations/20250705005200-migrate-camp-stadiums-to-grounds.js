'use strict';

module.exports = {
  async up(queryInterface, _Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // move existing camp stadiums into grounds
      await queryInterface.sequelize.query(
        `INSERT INTO grounds (id, name, address_id, yandex_url, capacity, phone, website, created_by, updated_by, created_at, updated_at, deleted_at)
         SELECT id, name, address_id, yandex_url, capacity, phone, website, created_by, updated_by, created_at, updated_at, deleted_at
         FROM camp_stadiums`,
        { transaction }
      );

      // migrate training references
      await queryInterface.sequelize.query(
        'UPDATE trainings SET ground_id = camp_stadium_id WHERE camp_stadium_id IS NOT NULL',
        { transaction }
      );

      // remove old foreign key columns
      await queryInterface.removeColumn('trainings', 'camp_stadium_id', {
        transaction,
      });
      const refereeGroups = await queryInterface
        .describeTable('referee_groups')
        .catch(() => null);
      if (refereeGroups && refereeGroups.camp_stadium_id) {
        await queryInterface.removeColumn('referee_groups', 'camp_stadium_id', {
          transaction,
        });
      }

      // drop obsolete tables
      await queryInterface.dropTable('camp_stadium_parking_types', {
        transaction,
      });
      await queryInterface.dropTable('parking_types', { transaction });
      await queryInterface.dropTable('camp_stadiums', { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // recreate camp_stadiums table
      await queryInterface.createTable(
        'camp_stadiums',
        {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
            primaryKey: true,
          },
          name: { type: Sequelize.STRING(255), allowNull: false },
          address_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'addresses', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          yandex_url: { type: Sequelize.STRING(500) },
          capacity: { type: Sequelize.INTEGER },
          phone: { type: Sequelize.STRING(15) },
          website: { type: Sequelize.STRING(255) },
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
        },
        { transaction }
      );

      // recreate parking_types table
      await queryInterface.createTable(
        'parking_types',
        {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
            primaryKey: true,
          },
          name: { type: Sequelize.STRING(100), allowNull: false, unique: true },
          alias: {
            type: Sequelize.STRING(100),
            allowNull: false,
            unique: true,
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
        },
        { transaction }
      );

      // recreate camp_stadium_parking_types table
      await queryInterface.createTable(
        'camp_stadium_parking_types',
        {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
            primaryKey: true,
          },
          camp_stadium_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'camp_stadiums', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          parking_type_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'parking_types', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          price: { type: Sequelize.DECIMAL(10, 2) },
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
        },
        { transaction }
      );

      await queryInterface.addConstraint(
        'camp_stadium_parking_types',
        {
          fields: ['camp_stadium_id', 'parking_type_id'],
          type: 'unique',
          name: 'uq_camp_stadium_parking_types_pair',
          where: { deleted_at: null },
        },
        { transaction }
      );

      // restore camp_stadium_id column on trainings
      await queryInterface.addColumn(
        'trainings',
        'camp_stadium_id',
        {
          type: Sequelize.UUID,
          references: { model: 'camp_stadiums', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        { transaction }
      );
      const refTable = await queryInterface
        .describeTable('referee_groups')
        .catch(() => null);
      if (refTable && !refTable.camp_stadium_id) {
        await queryInterface.addColumn(
          'referee_groups',
          'camp_stadium_id',
          {
            type: Sequelize.UUID,
            references: { model: 'camp_stadiums', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          { transaction }
        );
      }

      // copy data back to camp_stadiums and trainings
      await queryInterface.sequelize.query(
        `INSERT INTO camp_stadiums (id, name, address_id, yandex_url, capacity, phone, website, created_by, updated_by, created_at, updated_at, deleted_at)
         SELECT id, name, address_id, yandex_url, capacity, phone, website, created_by, updated_by, created_at, updated_at, deleted_at FROM grounds`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        'UPDATE trainings SET camp_stadium_id = ground_id WHERE ground_id IS NOT NULL',
        { transaction }
      );
    });
  },
};
