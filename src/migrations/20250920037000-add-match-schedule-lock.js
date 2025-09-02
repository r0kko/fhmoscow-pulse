'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'matches';
    await queryInterface.addColumn(table, 'schedule_locked_by_admin', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn(table, 'schedule_locked_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'schedule_locked_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex(table, ['schedule_locked_by_admin']);
  },

  async down(queryInterface) {
    const table = 'matches';
    await queryInterface
      .removeIndex(table, ['schedule_locked_by_admin'])
      .catch(() => {});
    await queryInterface
      .removeColumn(table, 'schedule_locked_by')
      .catch(() => {});
    await queryInterface
      .removeColumn(table, 'schedule_locked_at')
      .catch(() => {});
    await queryInterface
      .removeColumn(table, 'schedule_locked_by_admin')
      .catch(() => {});
  },
};
