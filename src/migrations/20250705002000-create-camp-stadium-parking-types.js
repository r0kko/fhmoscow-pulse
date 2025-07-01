'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('camp_stadium_parking_types', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      camp_stadium_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'camp_stadiums', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      parking_type_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'parking_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      price: { type: Sequelize.DECIMAL(10, 2) },
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
    await queryInterface.addConstraint('camp_stadium_parking_types', {
      fields: ['camp_stadium_id', 'parking_type_id'],
      type: 'unique',
      name: 'uq_camp_stadium_parking_types_pair',
      where: { deleted_at: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('camp_stadium_parking_types');
  },
};
