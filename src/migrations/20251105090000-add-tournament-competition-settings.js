'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('competition_types', {
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
    await queryInterface.addIndex('competition_types', ['alias'], {
      unique: true,
      name: 'uniq_competition_types_alias',
    });

    await queryInterface.addColumn('tournaments', 'competition_type_id', {
      type: Sequelize.UUID,
      references: { model: 'competition_types', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      allowNull: true,
    });
    await queryInterface.addColumn('tournaments', 'match_format', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.addColumn('tournaments', 'referee_payment_type', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.addIndex('tournaments', ['competition_type_id'], {
      name: 'idx_tournaments_competition_type_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'tournaments',
      'idx_tournaments_competition_type_id'
    );
    await queryInterface.removeColumn('tournaments', 'referee_payment_type');
    await queryInterface.removeColumn('tournaments', 'match_format');
    await queryInterface.removeColumn('tournaments', 'competition_type_id');
    await queryInterface.removeIndex(
      'competition_types',
      'uniq_competition_types_alias'
    );
    await queryInterface.dropTable('competition_types');
  },
};
