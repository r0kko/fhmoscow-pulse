'use strict';

const { randomUUID } = require('crypto');

const MANAGEMENT_GROUP_NAME = 'Руководство';
const BRIGADE_GROUP_NAME = 'Судьи в бригаде';

const MANAGEMENT_ROLES = [
  { name: 'Сотрудник департамента', sort_order: 1 },
  { name: 'Судья видеоповторов', sort_order: 2 },
  { name: 'Инспектор матча', sort_order: 3 },
  { name: 'Наставник', sort_order: 4 },
  { name: 'Видео-наставник', sort_order: 5 },
  { name: 'Представитель КХЛ', sort_order: 6 },
  { name: 'Представитель ФХР', sort_order: 7 },
  { name: 'Текстовая трансляция', sort_order: 8 },
  { name: 'Статистик', sort_order: 9 },
  { name: 'Диктор', sort_order: 10 },
];

const ADDED_ROLE_NAMES = [
  'Инспектор матча',
  'Представитель КХЛ',
  'Представитель ФХР',
  'Текстовая трансляция',
  'Статистик',
  'Диктор',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const groups = await queryInterface.sequelize.query(
        `
          SELECT id, name
          FROM referee_role_groups
          WHERE deleted_at IS NULL
            AND name IN (:managementName, :brigadeName)
        `,
        {
          replacements: {
            managementName: MANAGEMENT_GROUP_NAME,
            brigadeName: BRIGADE_GROUP_NAME,
          },
          type: Sequelize.QueryTypes.SELECT,
          transaction,
        }
      );

      const groupByName = new Map(groups.map((row) => [row.name, row.id]));
      const managementGroupId = groupByName.get(MANAGEMENT_GROUP_NAME);
      if (!managementGroupId) {
        throw new Error('Referee role group "Руководство" not found');
      }

      const roleNames = MANAGEMENT_ROLES.map((role) => role.name);
      const existingRoles = await queryInterface.sequelize.query(
        `
          SELECT id, name, referee_role_group_id
          FROM referee_roles
          WHERE deleted_at IS NULL
            AND name IN (:roleNames)
          ORDER BY created_at ASC
        `,
        {
          replacements: { roleNames },
          type: Sequelize.QueryTypes.SELECT,
          transaction,
        }
      );

      const rolesByName = new Map();
      for (const role of existingRoles) {
        if (!rolesByName.has(role.name)) {
          rolesByName.set(role.name, []);
        }
        rolesByName.get(role.name).push(role);
      }

      const now = new Date();
      const toInsert = [];

      for (const target of MANAGEMENT_ROLES) {
        const variants = rolesByName.get(target.name) || [];
        const canonical =
          variants.find(
            (row) => row.referee_role_group_id === managementGroupId
          ) || variants[0];

        if (!canonical) {
          toInsert.push({
            id: randomUUID(),
            referee_role_group_id: managementGroupId,
            name: target.name,
            sort_order: target.sort_order,
            created_at: now,
            updated_at: now,
          });
          continue;
        }

        await queryInterface.sequelize.query(
          `
            UPDATE referee_roles
            SET referee_role_group_id = :managementGroupId,
                sort_order = :sortOrder,
                updated_at = :now
            WHERE id = :id
          `,
          {
            replacements: {
              id: canonical.id,
              managementGroupId,
              sortOrder: target.sort_order,
              now,
            },
            type: Sequelize.QueryTypes.UPDATE,
            transaction,
          }
        );

        const duplicates = variants.filter((row) => row.id !== canonical.id);
        if (duplicates.length) {
          const duplicateIds = duplicates.map((row) => row.id);
          await queryInterface.sequelize.query(
            `
              UPDATE referee_roles
              SET deleted_at = :now,
                  updated_at = :now
              WHERE id IN (:duplicateIds)
                AND deleted_at IS NULL
            `,
            {
              replacements: { duplicateIds, now },
              type: Sequelize.QueryTypes.UPDATE,
              transaction,
            }
          );
        }
      }

      if (toInsert.length) {
        await queryInterface.bulkInsert('referee_roles', toInsert, {
          transaction,
        });
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const groups = await queryInterface.sequelize.query(
        `
          SELECT id, name
          FROM referee_role_groups
          WHERE deleted_at IS NULL
            AND name IN (:managementName, :brigadeName)
        `,
        {
          replacements: {
            managementName: MANAGEMENT_GROUP_NAME,
            brigadeName: BRIGADE_GROUP_NAME,
          },
          type: Sequelize.QueryTypes.SELECT,
          transaction,
        }
      );

      const groupByName = new Map(groups.map((row) => [row.name, row.id]));
      const managementGroupId = groupByName.get(MANAGEMENT_GROUP_NAME);
      const brigadeGroupId = groupByName.get(BRIGADE_GROUP_NAME);
      if (!managementGroupId) return;

      if (brigadeGroupId) {
        await queryInterface.sequelize.query(
          `
            UPDATE referee_roles
            SET referee_role_group_id = :brigadeGroupId,
                sort_order = 5,
                updated_at = :now
            WHERE name = 'Судья видеоповторов'
              AND referee_role_group_id = :managementGroupId
              AND deleted_at IS NULL
          `,
          {
            replacements: {
              brigadeGroupId,
              managementGroupId,
              now: new Date(),
            },
            type: Sequelize.QueryTypes.UPDATE,
            transaction,
          }
        );
      }

      await queryInterface.bulkDelete(
        'referee_roles',
        {
          referee_role_group_id: managementGroupId,
          name: ADDED_ROLE_NAMES,
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          UPDATE referee_roles
          SET sort_order = CASE
              WHEN name = 'Сотрудник департамента' THEN 1
              WHEN name = 'Наставник' THEN 2
              WHEN name = 'Видео-наставник' THEN 3
              ELSE sort_order
            END,
            updated_at = :now
          WHERE referee_role_group_id = :managementGroupId
            AND name IN ('Сотрудник департамента', 'Наставник', 'Видео-наставник')
            AND deleted_at IS NULL
        `,
        {
          replacements: {
            managementGroupId,
            now: new Date(),
          },
          type: Sequelize.QueryTypes.UPDATE,
          transaction,
        }
      );
    });
  },
};
