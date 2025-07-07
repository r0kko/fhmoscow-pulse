'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('medical_exams', 'status_id');
    await queryInterface.changeColumn('medical_exams', 'start_at', {
      type: Sequelize.DATE,
      allowNull: false,
    });
    await queryInterface.changeColumn('medical_exams', 'end_at', {
      type: Sequelize.DATE,
      allowNull: false,
    });
    await queryInterface.dropTable('medical_exam_statuses');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('medical_exam_statuses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      name: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      alias: { type: Sequelize.STRING(100), allowNull: false, unique: true },
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
    await queryInterface.addColumn('medical_exams', 'status_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'medical_exam_statuses', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.changeColumn('medical_exams', 'start_at', {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });
    await queryInterface.changeColumn('medical_exams', 'end_at', {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });
  },
};
