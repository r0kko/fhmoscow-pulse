'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('training_registrations', 'training_role_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'training_roles', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('training_registrations', 'training_role_id');
  },
};
