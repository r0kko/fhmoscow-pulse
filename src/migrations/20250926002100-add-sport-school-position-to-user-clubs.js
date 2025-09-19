'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user_clubs', 'sport_school_position_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'sport_school_positions',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('user_clubs', ['sport_school_position_id'], {
      name: 'user_clubs_sport_school_position_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'user_clubs',
      'user_clubs_sport_school_position_id_idx'
    );
    await queryInterface.removeColumn(
      'user_clubs',
      'sport_school_position_id'
    );
  },
};
