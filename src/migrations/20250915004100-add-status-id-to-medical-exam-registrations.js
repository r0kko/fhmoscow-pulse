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
      `INSERT INTO medical_exam_registration_statuses (id, name, alias, created_at, updated_at)
       VALUES
         (uuid_generate_v4(), 'На рассмотрении', 'PENDING', NOW(), NOW()),
         (uuid_generate_v4(), 'Подтверждена', 'APPROVED', NOW(), NOW()),
         (uuid_generate_v4(), 'Отменена', 'CANCELED', NOW(), NOW()),
         (uuid_generate_v4(), 'Завершена', 'COMPLETED', NOW(), NOW())
       ON CONFLICT (alias) DO NOTHING;`
    );
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
