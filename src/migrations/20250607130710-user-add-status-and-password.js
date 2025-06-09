'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /* 1. Поле password (хранит bcrypt-хэш) */
    await queryInterface.addColumn('users', 'password', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });

    /* 2. Поле status_id + FK → user_status */
    await queryInterface.addColumn('users', 'status_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    await queryInterface.addConstraint('users', {
      fields: ['status_id'],
      type: 'foreign key',
      name: 'fk_users_status',
      references: { table: 'user_statuses', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeConstraint('users', 'fk_users_status');
    await queryInterface.removeColumn('users', 'status_id');
    await queryInterface.removeColumn('users', 'password');
  },
};
