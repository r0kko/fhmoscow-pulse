'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'sex_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addConstraint('users', {
      fields: ['sex_id'],
      type: 'foreign key',
      name: 'fk_users_sex',
      references: { table: 'sexes', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    let [male] = await queryInterface.sequelize.query(
      // eslint-disable-next-line
      "SELECT id FROM sexes WHERE alias = 'MALE' LIMIT 1;",
      { type: Sequelize.QueryTypes.SELECT }
    );
    if (!male) {
      const ids = await queryInterface.sequelize.query(
        'INSERT INTO sexes (id, name, alias, created_at, updated_at) VALUES ' +
          // eslint-disable-next-line
          "(uuid_generate_v4(), 'Мужской', 'MALE', NOW(), NOW())," +
          // eslint-disable-next-line
          "(uuid_generate_v4(), 'Женский', 'FEMALE', NOW(), NOW()) RETURNING id;",
        { type: Sequelize.QueryTypes.SELECT }
      );
      male = ids[0];
    }
    await queryInterface.sequelize.query(
      `-- noinspection SqlConstantExpressionForFile

UPDATE users SET sex_id = '${male.id}' WHERE sex_id IS NULL;`
    );
    await queryInterface.changeColumn('users', 'sex_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('users', 'fk_users_sex');
    await queryInterface.removeColumn('users', 'sex_id');
  },
};
