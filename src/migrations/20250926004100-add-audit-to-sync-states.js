async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('sync_states', 'created_by', {
    type: Sequelize.UUID,
    allowNull: true,
  });
  await queryInterface.addColumn('sync_states', 'updated_by', {
    type: Sequelize.UUID,
    allowNull: true,
  });
}

async function down(queryInterface) {
  await queryInterface.removeColumn('sync_states', 'created_by');
  await queryInterface.removeColumn('sync_states', 'updated_by');
}

module.exports = { up, down };
