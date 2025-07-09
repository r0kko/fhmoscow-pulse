'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('medical_exam_registration_statuses', 'created_by', {
      type: Sequelize.UUID,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      allowNull: true,
    });
    await queryInterface.addColumn('medical_exam_registration_statuses', 'updated_by', {
      type: Sequelize.UUID,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('medical_exam_registration_statuses', 'updated_by');
    await queryInterface.removeColumn('medical_exam_registration_statuses', 'created_by');
  },
};
