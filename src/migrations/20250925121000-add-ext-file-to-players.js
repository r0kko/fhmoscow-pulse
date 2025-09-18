'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('players', 'photo_ext_file_id', {
      type: Sequelize.UUID,
      references: { model: 'ext_files', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('players', ['photo_ext_file_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('players', ['photo_ext_file_id']);
    await queryInterface.removeColumn('players', 'photo_ext_file_id');
  },
};
