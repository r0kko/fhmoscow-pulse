'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('medical_exam_registrations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      medical_exam_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'medical_exams', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      approved: { type: Sequelize.BOOLEAN, defaultValue: false },
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
    await queryInterface.addConstraint('medical_exam_registrations', {
      fields: ['medical_exam_id', 'user_id'],
      type: 'unique',
      name: 'uq_medical_exam_registrations_exam_user',
      where: { deleted_at: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('medical_exam_registrations');
  },
};
