'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'UPDATE normative_results SET online = FALSE, retake = FALSE WHERE online IS NULL OR retake IS NULL'
    );
  },

  async down() {
    // no revert needed
  },
};
