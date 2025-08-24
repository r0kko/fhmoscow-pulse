'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('staff', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      external_id: { type: Sequelize.INTEGER, allowNull: false, unique: true },
      surname: { type: Sequelize.STRING(255) },
      name: { type: Sequelize.STRING(255) },
      patronymic: { type: Sequelize.STRING(255) },
      date_of_birth: { type: Sequelize.DATE },
      email: { type: Sequelize.STRING(255) },
      photo_external_id: { type: Sequelize.INTEGER },
      created_by: {
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      deleted_at: { type: Sequelize.DATE },
    });
    await queryInterface.addIndex('staff', ['surname']);
    await queryInterface.addIndex('staff', ['name']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('staff');
  },
};
