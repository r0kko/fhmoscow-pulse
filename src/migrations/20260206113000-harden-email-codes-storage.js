'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('email_codes', 'purpose', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'verify',
    });
    await queryInterface.addColumn('email_codes', 'code_hash', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.addColumn('email_codes', 'attempt_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('email_codes', 'locked_until', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('email_codes', 'consumed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.changeColumn('email_codes', 'code', {
      type: Sequelize.STRING(6),
      allowNull: true,
    });

    await queryInterface.addIndex('email_codes', ['user_id', 'purpose'], {
      name: 'email_codes_user_purpose_idx',
    });
    await queryInterface.addIndex(
      'email_codes',
      ['user_id', 'purpose', 'consumed_at', 'expires_at'],
      {
        name: 'email_codes_active_lookup_idx',
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex(
      'email_codes',
      'email_codes_active_lookup_idx'
    );
    await queryInterface.removeIndex(
      'email_codes',
      'email_codes_user_purpose_idx'
    );
    await queryInterface.changeColumn('email_codes', 'code', {
      type: Sequelize.STRING(6),
      allowNull: false,
    });
    await queryInterface.removeColumn('email_codes', 'consumed_at');
    await queryInterface.removeColumn('email_codes', 'locked_until');
    await queryInterface.removeColumn('email_codes', 'attempt_count');
    await queryInterface.removeColumn('email_codes', 'code_hash');
    await queryInterface.removeColumn('email_codes', 'purpose');
  },
};
