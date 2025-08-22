'use strict';

module.exports = {
  async up(queryInterface, _Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'ALTER TABLE grounds DROP COLUMN IF EXISTS capacity, DROP COLUMN IF EXISTS phone, DROP COLUMN IF EXISTS website'
      );
    } else {
      const desc = await queryInterface
        .describeTable('grounds')
        .catch(() => ({}));
      if (desc && desc.capacity)
        await queryInterface.removeColumn('grounds', 'capacity');
      if (desc && desc.phone)
        await queryInterface.removeColumn('grounds', 'phone');
      if (desc && desc.website)
        await queryInterface.removeColumn('grounds', 'website');
    }
  },

  async down(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'ALTER TABLE grounds ADD COLUMN IF NOT EXISTS capacity INTEGER, ADD COLUMN IF NOT EXISTS phone VARCHAR(15), ADD COLUMN IF NOT EXISTS website VARCHAR(255)'
      );
    } else {
      const desc = await queryInterface
        .describeTable('grounds')
        .catch(() => ({}));
      if (!desc.capacity)
        await queryInterface.addColumn('grounds', 'capacity', {
          type: Sequelize.INTEGER,
          allowNull: true,
        });
      if (!desc.phone)
        await queryInterface.addColumn('grounds', 'phone', {
          type: Sequelize.STRING(15),
          allowNull: true,
        });
      if (!desc.website)
        await queryInterface.addColumn('grounds', 'website', {
          type: Sequelize.STRING(255),
          allowNull: true,
        });
    }
  },
};
