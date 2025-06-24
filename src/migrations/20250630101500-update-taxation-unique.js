'use strict';

module.exports = {
  up: async (queryInterface, _Sequelize) => {
    await queryInterface.removeConstraint('taxations', 'taxations_user_id_key');
    await queryInterface.addIndex('taxations', ['user_id'], {
      name: 'uq_taxations_user_id_not_deleted',
      unique: true,
      where: { deleted_at: null },
    });
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.removeIndex('taxations', 'uq_taxations_user_id_not_deleted');
    await queryInterface.addConstraint('taxations', {
      fields: ['user_id'],
      type: 'unique',
      name: 'taxations_user_id_key',
    });
  },
};
