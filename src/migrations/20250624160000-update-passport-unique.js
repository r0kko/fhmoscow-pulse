'use strict';

module.exports = {
  up: async (queryInterface, _Sequelize) => {
    // remove existing unique constraint on user_id
    await queryInterface.removeConstraint('passports', 'passports_user_id_key');
    // add partial unique index for active passports
    await queryInterface.addIndex('passports', ['user_id'], {
      name: 'uq_passports_user_id_not_deleted',
      unique: true,
      where: {
        deleted_at: null,
      },
    });
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.removeIndex('passports', 'uq_passports_user_id_not_deleted');
    await queryInterface.addConstraint('passports', {
      fields: ['user_id'],
      type: 'unique',
      name: 'passports_user_id_key',
    });
  },
};
