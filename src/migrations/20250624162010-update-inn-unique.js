'use strict';

module.exports = {
  up: async (queryInterface, _Sequelize) => {
    // remove existing unique constraint on user_id
    await queryInterface.removeConstraint('inns', 'inns_user_id_key');
    // add partial unique index for active inns
    await queryInterface.addIndex('inns', ['user_id'], {
      name: 'uq_inns_user_id_not_deleted',
      unique: true,
      where: { deleted_at: null },
    });
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.removeIndex('inns', 'uq_inns_user_id_not_deleted');
    await queryInterface.addConstraint('inns', {
      fields: ['user_id'],
      type: 'unique',
      name: 'inns_user_id_key',
    });
  },
};
