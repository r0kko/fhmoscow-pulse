'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeConstraint(
      'training_registrations',
      'uq_training_registrations_training_user'
    );
    await queryInterface.addIndex(
      'training_registrations',
      ['training_id', 'user_id'],
      {
        name: 'uq_training_registrations_training_user',
        unique: true,
        where: { deleted_at: null },
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'training_registrations',
      'uq_training_registrations_training_user'
    );
    await queryInterface.addConstraint('training_registrations', {
      fields: ['training_id', 'user_id'],
      type: 'unique',
      name: 'uq_training_registrations_training_user',
    });
  },
};
