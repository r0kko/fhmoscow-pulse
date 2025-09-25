'use strict';

const { randomUUID } = require('crypto');

const GROUP_ALIAS = 'FHMO_STAFF';
const GROUP_NAME = 'Сотрудник ФХМ';

const DEPARTMENTS = [
  {
    alias: 'FHMO_JUDGING_DEPARTMENT',
    name: 'Отдел организации судейства',
    roles: [
      { alias: 'FHMO_JUDGING_HEAD', name: 'Руководитель отдела' },
      {
        alias: 'FHMO_JUDGING_LEAD_SPECIALIST',
        name: 'Ведущий специалист по судейству',
      },
      { alias: 'FHMO_JUDGING_SPECIALIST', name: 'Специалист по судейству' },
      {
        alias: 'FHMO_JUDGING_TRAINING_CURATOR',
        name: 'Куратор центра подготовки судей',
      },
    ],
  },
  {
    alias: 'FHMO_COMPETITIONS_DEPARTMENT',
    name: 'Отдел проведения соревнований',
    roles: [
      { alias: 'FHMO_COMPETITIONS_HEAD', name: 'Руководитель отдела' },
      {
        alias: 'FHMO_COMPETITIONS_LEAD_SPECIALIST',
        name: 'Ведущий специалист по проведению соревнований',
      },
      {
        alias: 'FHMO_COMPETITIONS_SPECIALIST',
        name: 'Специалист по проведению соревнований',
      },
    ],
  },
  {
    alias: 'FHMO_MEDIA_DEPARTMENT',
    name: 'Отдел медиа и коммуникаций',
    roles: [
      { alias: 'FHMO_MEDIA_PRESS_SECRETARY', name: 'Пресс-секретарь' },
      { alias: 'FHMO_MEDIA_SMM_MANAGER', name: 'СММ-менеджер' },
      { alias: 'FHMO_MEDIA_CONTENT_MODERATOR', name: 'Модератор контента' },
    ],
  },
  {
    alias: 'FHMO_LEGAL_DEPARTMENT',
    name: 'Юридический отдел',
    roles: [{ alias: 'FHMO_LEGAL_LAWYER', name: 'Юрист' }],
  },
  {
    alias: 'FHMO_ACCOUNTING_DEPARTMENT',
    name: 'Бухгалтерия',
    roles: [
      { alias: 'FHMO_ACCOUNTING_CHIEF_ACCOUNTANT', name: 'Главный бухгалтер' },
    ],
  },
  {
    alias: 'FHMO_ADMINISTRATION_DEPARTMENT',
    name: 'Администрация',
    roles: [
      { alias: 'FHMO_ADMINISTRATION_PRESIDENT', name: 'Президент' },
      {
        alias: 'FHMO_ADMINISTRATION_EXECUTIVE_DIRECTOR',
        name: 'Исполнительный директор',
      },
    ],
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    let displayOrder = 100;
    const roles = [];

    for (const department of DEPARTMENTS) {
      for (const role of department.roles) {
        roles.push({
          id: randomUUID(),
          name: role.name,
          alias: role.alias,
          group_alias: GROUP_ALIAS,
          group_name: GROUP_NAME,
          department_alias: department.alias,
          department_name: department.name,
          display_order: displayOrder++,
          created_at: now,
          updated_at: now,
        });
      }
    }

    await queryInterface.bulkInsert('roles', roles, {
      ignoreDuplicates: true,
    });
  },

  async down(queryInterface) {
    const aliases = DEPARTMENTS.flatMap((d) => d.roles.map((r) => r.alias));
    await queryInterface.bulkDelete('roles', {
      alias: aliases,
    });
  },
};
