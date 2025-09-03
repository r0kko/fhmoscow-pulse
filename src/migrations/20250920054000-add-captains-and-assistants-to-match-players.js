'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('match_players', 'is_captain', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('match_players', 'assistant_order', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addIndex('match_players', ['is_captain']);
    await queryInterface.addIndex('match_players', ['assistant_order']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'Реализуй все необходимые изменения на всех уровнях проекта. Следуй лучшим практикам, стандартам корпораций и дизайн-коду проекта + лучшие практкики UI UX.  Используй комплексный подход и полный аудит.\nmatch_players',
      ['assistant_order']
    );
    await queryInterface.removeIndex('match_players', ['is_captain']);
    await queryInterface.removeColumn('match_players', 'assistant_order');
    await queryInterface.removeColumn('match_players', 'is_captain');
  },
};
