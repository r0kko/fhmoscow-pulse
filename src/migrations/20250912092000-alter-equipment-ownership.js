'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('equipment', 'owner_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('equipment', 'assignment_document_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'documents', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('equipment', ['owner_id']);
    await queryInterface.addIndex('equipment', ['assignment_document_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('equipment', 'assignment_document_id');
    await queryInterface.removeColumn('equipment', 'owner_id');
  },
};
