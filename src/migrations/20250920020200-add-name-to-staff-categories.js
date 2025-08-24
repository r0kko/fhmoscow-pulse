'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface
      .describeTable('staff_categories')
      .catch(() => null);
    if (desc && !desc.name) {
      await queryInterface.addColumn('staff_categories', 'name', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },
  async down(queryInterface) {
    await queryInterface
      .removeColumn('staff_categories', 'name')
      .catch(() => {});
  },
};
