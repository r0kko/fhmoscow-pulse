'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Drop existing FK constraints on grounds.address_id (name may vary)
      const [rows] = await queryInterface.sequelize.query(
        `SELECT con.constraint_name
         FROM information_schema.table_constraints con
         JOIN information_schema.key_column_usage kcu
           ON con.constraint_name = kcu.constraint_name
          AND con.constraint_schema = kcu.constraint_schema
         WHERE con.constraint_type = 'FOREIGN KEY'
           AND con.table_name = 'grounds'
           AND kcu.column_name = 'address_id'`,
        { transaction }
      );
      for (const r of rows) {
        await queryInterface.removeConstraint('grounds', r.constraint_name, {
          transaction,
        });
      }

      // Add FK with ON DELETE SET NULL
      await queryInterface.addConstraint('grounds', {
        fields: ['address_id'],
        type: 'foreign key',
        name: 'fk_grounds_address_id',
        references: { table: 'addresses', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Replace with ON DELETE CASCADE as it was before
      try {
        await queryInterface.removeConstraint(
          'grounds',
          'fk_grounds_address_id',
          {
            transaction,
          }
        );
      } catch {
        /* empty */
      }

      await queryInterface.addConstraint('grounds', {
        fields: ['address_id'],
        type: 'foreign key',
        name: 'fk_grounds_address_id',
        references: { table: 'addresses', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        transaction,
      });
    });
  },
};
