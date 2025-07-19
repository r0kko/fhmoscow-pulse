'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeIndex('normative_type_zones', 'uq_normative_type_zone');
    await queryInterface.addColumn('normative_type_zones', 'sex_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addConstraint('normative_type_zones', {
      fields: ['sex_id'],
      type: 'foreign key',
      name: 'fk_normative_type_zones_sex',
      references: { table: 'sexes', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    const [male] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT id FROM sexes WHERE alias = 'MALE' LIMIT 1;",
      { type: Sequelize.QueryTypes.SELECT }
    );
    if (male) {
      await queryInterface.sequelize.query(
        `UPDATE normative_type_zones SET sex_id = '${male.id}' WHERE sex_id IS NULL;`
      );
    }
    await queryInterface.changeColumn('normative_type_zones', 'sex_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
    await queryInterface.addIndex('normative_type_zones', ['normative_type_id', 'zone_id', 'sex_id'], {
      name: 'uq_normative_type_zone_sex',
      unique: true,
      where: { deleted_at: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('normative_type_zones', 'uq_normative_type_zone_sex');
    await queryInterface.removeConstraint('normative_type_zones', 'fk_normative_type_zones_sex');
    await queryInterface.removeColumn('normative_type_zones', 'sex_id');
    await queryInterface.addIndex('normative_type_zones', ['normative_type_id', 'zone_id'], {
      name: 'uq_normative_type_zone',
      unique: true,
      where: { deleted_at: null },
    });
  },
};
