export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('training_types', 'for_camp', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
  await queryInterface.sequelize.query(
    'UPDATE training_types SET for_camp = true'
  );
}

export async function down(queryInterface) {
  await queryInterface.removeColumn('training_types', 'for_camp');
}
