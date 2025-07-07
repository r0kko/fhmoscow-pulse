'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('medical_exam_registrations', 'status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    });
    await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "UPDATE medical_exam_registrations SET status = CASE WHEN approved = true THEN 'approved' WHEN approved = false THEN 'canceled' ELSE 'pending' END"
    );
    await queryInterface.removeColumn('medical_exam_registrations', 'approved');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('medical_exam_registrations', 'approved', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "UPDATE medical_exam_registrations SET approved = CASE WHEN status = 'approved' OR status = 'completed' THEN true WHEN status = 'canceled' THEN false ELSE NULL END"
    );
    await queryInterface.removeColumn('medical_exam_registrations', 'status');
  },
};
