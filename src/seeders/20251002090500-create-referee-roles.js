'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS cnt FROM referee_role_groups WHERE name IN (:name1, :name2, :name3);',
      {
        replacements: {
          name1: 'Судьи в поле',
          name2: 'Судьи в бригаде',
          name3: 'Руководство',
        },
      }
    );
    if (Number(existing[0].cnt) > 0) return;

    const groups = [
      { id: randomUUID(), name: 'Судьи в поле', sort_order: 1 },
      { id: randomUUID(), name: 'Судьи в бригаде', sort_order: 2 },
      { id: randomUUID(), name: 'Руководство', sort_order: 3 },
    ];

    await queryInterface.bulkInsert(
      'referee_role_groups',
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        sort_order: g.sort_order,
        created_at: now,
        updated_at: now,
      }))
    );

    const roles = [
      { name: 'Главный', group: 'Судьи в поле', sort_order: 1 },
      { name: 'Линейный', group: 'Судьи в поле', sort_order: 2 },
      { name: 'Резервный', group: 'Судьи в поле', sort_order: 3 },
      { name: 'Секретарь матча', group: 'Судьи в бригаде', sort_order: 1 },
      { name: 'Судья времени', group: 'Судьи в бригаде', sort_order: 2 },
      {
        name: 'Судья при оштрафованных',
        group: 'Судьи в бригаде',
        sort_order: 3,
      },
      {
        name: 'Судья координатор рекламной паузы',
        group: 'Судьи в бригаде',
        sort_order: 4,
      },
      { name: 'Судья видеоповторов', group: 'Руководство', sort_order: 2 },
      { name: 'Сотрудник департамента', group: 'Руководство', sort_order: 1 },
      { name: 'Инспектор матча', group: 'Руководство', sort_order: 3 },
      { name: 'Наставник', group: 'Руководство', sort_order: 4 },
      { name: 'Видео-наставник', group: 'Руководство', sort_order: 5 },
      { name: 'Представитель КХЛ', group: 'Руководство', sort_order: 6 },
      { name: 'Представитель ФХР', group: 'Руководство', sort_order: 7 },
      { name: 'Текстовая трансляция', group: 'Руководство', sort_order: 8 },
      { name: 'Статистик', group: 'Руководство', sort_order: 9 },
      { name: 'Диктор', group: 'Руководство', sort_order: 10 },
    ];

    const groupByName = new Map(groups.map((g) => [g.name, g.id]));
    await queryInterface.bulkInsert(
      'referee_roles',
      roles.map((r) => ({
        id: randomUUID(),
        referee_role_group_id: groupByName.get(r.group),
        name: r.name,
        sort_order: r.sort_order,
        created_at: now,
        updated_at: now,
      }))
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('referee_roles', {
      name: [
        'Главный',
        'Линейный',
        'Резервный',
        'Секретарь матча',
        'Судья времени',
        'Судья при оштрафованных',
        'Судья координатор рекламной паузы',
        'Судья видеоповторов',
        'Сотрудник департамента',
        'Инспектор матча',
        'Наставник',
        'Видео-наставник',
        'Представитель КХЛ',
        'Представитель ФХР',
        'Текстовая трансляция',
        'Статистик',
        'Диктор',
      ],
    });
    await queryInterface.bulkDelete('referee_role_groups', {
      name: ['Судьи в поле', 'Судьи в бригаде', 'Руководство'],
    });
  },
};
