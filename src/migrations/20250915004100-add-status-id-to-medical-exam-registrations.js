'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('medical_exam_registrations', 'status_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'medical_exam_registration_statuses', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.sequelize.query(
      `UPDATE medical_exam_registrations r SET status_id = s.id FROM medical_exam_registration_statuses s WHERE UPPER(r.status) = s.alias`
    );
    const [pending] = await queryInterface.sequelize.query(
      "SELECT id FROM medical_exam_registration_statuses WHERE alias = 'PENDING' LIMIT 1;"
    );
    await queryInterface.changeColumn('medical_exam_registrations', 'status_id', {
      type: Sequelize.UUID,
      allowNull: false,
      defaultValue: pending[0].id,
    });
    await queryInterface.removeColumn('medical_exam_registrations', 'status');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('medical_exam_registrations', 'status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    });
    await queryInterface.sequelize.query(
      `UPDATE medical_exam_registrations r SET status = LOWER(s.alias) FROM medical_exam_registration_statuses s WHERE r.status_id = s.id`
    );
    await queryInterface.removeColumn('medical_exam_registrations', 'status_id');
  },
};
