'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'sex_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
    await queryInterface.addConstraint('users', {
      fields: ['sex_id'],
      type: 'foreign key',
      name: 'fk_users_sex',
      references: { table: 'sexes', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('users', 'fk_users_sex');
    await queryInterface.removeColumn('users', 'sex_id');
  },
};
