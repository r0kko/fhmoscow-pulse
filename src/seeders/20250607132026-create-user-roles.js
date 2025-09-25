'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const roles = [
      {
        id: randomUUID(),
        name: 'Admin',
        alias: 'ADMIN',
        group_alias: null,
        group_name: null,
        department_alias: null,
        department_name: null,
        display_order: 10,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Referee',
        alias: 'REFEREE',
        group_alias: null,
        group_name: null,
        department_alias: null,
        department_name: null,
        display_order: 20,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Судья в бригаде',
        alias: 'BRIGADE_REFEREE',
        group_alias: null,
        group_name: null,
        department_alias: null,
        department_name: null,
        display_order: 30,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Специалист по судейству (судьи в поле)',
        alias: 'FIELD_REFEREE_SPECIALIST',
        group_alias: null,
        group_name: null,
        department_alias: null,
        department_name: null,
        display_order: 40,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Специалист по судейству (судьи в бригаде)',
        alias: 'BRIGADE_REFEREE_SPECIALIST',
        group_alias: null,
        group_name: null,
        department_alias: null,
        department_name: null,
        display_order: 50,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Сотрудник спортивной школы',
        alias: 'SPORT_SCHOOL_STAFF',
        group_alias: null,
        group_name: null,
        department_alias: null,
        department_name: null,
        display_order: 60,
        created_at: now,
        updated_at: now,
      },
    ];

    await queryInterface.bulkInsert('roles', roles, {
      ignoreDuplicates: true, // PG → ON CONFLICT DO NOTHING
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', {
      alias: [
        'ADMIN',
        'REFEREE',
        'BRIGADE_REFEREE',
        'FIELD_REFEREE_SPECIALIST',
        'BRIGADE_REFEREE_SPECIALIST',
        'SPORT_SCHOOL_STAFF',
      ],
    });
  },
};
