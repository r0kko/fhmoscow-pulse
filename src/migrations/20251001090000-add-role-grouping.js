'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('roles', 'group_alias', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('roles', 'group_name', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
    await queryInterface.addColumn('roles', 'department_alias', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('roles', 'department_name', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
    await queryInterface.addColumn('roles', 'display_order', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addIndex('roles', ['group_alias'], {
      name: 'idx_roles_group_alias',
    });
    await queryInterface.addIndex('roles', ['department_alias'], {
      name: 'idx_roles_department_alias',
    });
    await queryInterface.addIndex(
      'roles',
      ['group_alias', 'department_alias', 'display_order'],
      {
        name: 'idx_roles_group_department_order',
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'roles',
      'idx_roles_group_department_order'
    );
    await queryInterface.removeIndex('roles', 'idx_roles_department_alias');
    await queryInterface.removeIndex('roles', 'idx_roles_group_alias');
    await queryInterface.removeColumn('roles', 'display_order');
    await queryInterface.removeColumn('roles', 'department_name');
    await queryInterface.removeColumn('roles', 'department_alias');
    await queryInterface.removeColumn('roles', 'group_name');
    await queryInterface.removeColumn('roles', 'group_alias');
  },
};
