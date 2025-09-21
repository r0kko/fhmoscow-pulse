async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('sync_states', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.literal('uuid_generate_v4()'),
      allowNull: false,
      primaryKey: true,
    },
    job: {
      type: Sequelize.STRING(120),
      allowNull: false,
      unique: true,
    },
    last_cursor: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    last_mode: {
      type: Sequelize.STRING(32),
      allowNull: true,
    },
    last_run_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    last_full_sync_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    meta: {
      type: Sequelize.JSONB,
      allowNull: true,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });
  await queryInterface.addIndex('sync_states', ['job'], {
    unique: true,
    name: 'sync_states_job_uk',
  });
}

async function down(queryInterface) {
  await queryInterface.dropTable('sync_states');
}

module.exports = { up, down };
