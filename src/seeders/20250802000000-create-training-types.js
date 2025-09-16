'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkDelete('training_types', {
      alias: ['ICE', 'BASIC_FIT', 'THEORY'],
    });
    const types = [
      {
        id: randomUUID(),
        name: 'ОФП',
        alias: 'OFP',
        default_capacity: 20,
        for_camp: true,
        online: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Ледовая подготовка',
        alias: 'ICE',
        default_capacity: 20,
        for_camp: true,
        online: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Нормативы • лёд',
        alias: 'NORM_ICE',
        default_capacity: 20,
        for_camp: true,
        online: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Нормативы • ОФП',
        alias: 'NORM_OFP',
        default_capacity: 20,
        for_camp: true,
        online: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Нормативы • Зал',
        alias: 'NORM_HALL',
        default_capacity: 20,
        for_camp: true,
        online: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Семинар',
        alias: 'SEMINAR',
        default_capacity: 20,
        for_camp: false,
        online: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Вебинар (онлайн)',
        alias: 'WEBINAR',
        default_capacity: 20,
        for_camp: false,
        online: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Тестирование по курсу',
        alias: 'COURSE_TEST',
        default_capacity: 20,
        for_camp: false,
        online: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Тестирование по ледовой подготовке',
        alias: 'ICE_TEST',
        default_capacity: 20,
        for_camp: false,
        online: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Тестирование по Правлам',
        alias: 'RULES_TEST',
        default_capacity: 20,
        for_camp: false,
        online: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Тестирование по Регламенту',
        alias: 'REGULATIONS_TEST',
        default_capacity: 20,
        for_camp: false,
        online: false,
        created_at: now,
        updated_at: now,
      },
    ];
    await queryInterface.bulkInsert('training_types', types, {
      ignoreDuplicates: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('training_types', {
      alias: [
        'OFP',
        'ICE',
        'NORM_ICE',
        'NORM_OFP',
        'NORM_HALL',
        'SEMINAR',
        'WEBINAR',
        'COURSE_TEST',
        'ICE_TEST',
        'RULES_TEST',
        'REGULATIONS_TEST',
      ],
    });
    const now = new Date();
    await queryInterface.bulkInsert('training_types', [
      {
        id: randomUUID(),
        name: 'Ледовая подготовка',
        alias: 'ICE',
        default_capacity: 20,
        for_camp: true,
        online: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Основы физической подготовки',
        alias: 'BASIC_FIT',
        default_capacity: 20,
        for_camp: true,
        online: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Теоретическая подготовка',
        alias: 'THEORY',
        default_capacity: 20,
        for_camp: true,
        online: false,
        created_at: now,
        updated_at: now,
      },
    ]);
  },
};
