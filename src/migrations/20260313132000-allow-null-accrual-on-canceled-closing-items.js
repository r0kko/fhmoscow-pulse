'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn(
      'referee_closing_document_items',
      'accrual_document_id',
      {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'referee_accrual_documents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn(
      'referee_closing_document_items',
      'accrual_document_id',
      {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'referee_accrual_documents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      }
    );
  },
};
