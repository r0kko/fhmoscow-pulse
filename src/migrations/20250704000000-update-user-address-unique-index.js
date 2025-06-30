'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeConstraint(
      'user_addresses',
      'uq_user_address_type'
    );
    await queryInterface.addIndex(
      'user_addresses',
      ['user_id', 'address_type_id'],
      {
        name: 'uq_user_address_type',
        unique: true,
        where: { deleted_at: null },
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('user_addresses', 'uq_user_address_type');
    await queryInterface.addConstraint('user_addresses', {
      fields: ['user_id', 'address_type_id'],
      type: 'unique',
      name: 'uq_user_address_type',
    });
  },
};
