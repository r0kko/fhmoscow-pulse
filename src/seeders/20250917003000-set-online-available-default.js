'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'UPDATE normative_types SET online_available = FALSE WHERE online_available IS NULL'
    );
  },

  async down() {
    // no revert needed
  },
};
