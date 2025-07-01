'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeIndex('medical_certificates', 'uq_medical_certificates_user_id_not_deleted');
  },

  async down(queryInterface) {
    await queryInterface.addIndex('medical_certificates', ['user_id'], {
      name: 'uq_medical_certificates_user_id_not_deleted',
      unique: true,
      where: { deleted_at: null },
    });
  },
};
