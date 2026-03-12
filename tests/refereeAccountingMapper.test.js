import { expect, test } from '@jest/globals';

import mapper from '../src/mappers/refereeAccountingMapper.js';

test('toPublicAccrualDocument preserves loaded accrual chain fields', () => {
  const result = mapper.toPublicAccrualDocument({
    id: 'doc-1',
    accrual_number: 'RA-202603-000001',
    tournament_id: 't1',
    match_id: 'm1',
    match_referee_id: 'mr1',
    referee_id: 'u1',
    referee_role_id: 'r1',
    stage_group_id: 'g1',
    ground_id: 'gr1',
    fare_code_snapshot: 'A1',
    tariff_rule_id: 'tariff-1',
    travel_rate_id: 'travel-1',
    match_date_snapshot: '2026-03-15',
    base_amount_rub: '2500.00',
    meal_amount_rub: '500.00',
    travel_amount_rub: '250.00',
    total_amount_rub: '3250.00',
    currency: 'RUB',
    created_at: '2026-03-15T10:00:00.000Z',
    updated_at: '2026-03-15T10:00:00.000Z',
    DocumentStatus: {
      id: 'ds-accrued',
      alias: 'ACCRUED',
      name_ru: 'Начислено',
    },
    Source: { id: 'src-manual', alias: 'MANUAL', name_ru: 'Вручную' },
    OriginalDocument: {
      id: 'doc-root',
      accrual_number: 'RA-202603-000000',
      DocumentStatus: {
        id: 'ds-accrued',
        alias: 'ACCRUED',
        name_ru: 'Начислено',
      },
    },
    Adjustments: [
      {
        id: 'doc-adj-1',
        accrual_number: 'RA-202603-000002',
        total_amount_rub: '100.00',
        created_at: '2026-03-16T10:00:00.000Z',
        DocumentStatus: {
          id: 'ds-accrued',
          alias: 'ACCRUED',
          name_ru: 'Начислено',
        },
      },
    ],
    Postings: [],
  });

  expect(result.original_document).toEqual({
    id: 'doc-root',
    accrual_number: 'RA-202603-000000',
    total_amount_rub: null,
    created_at: null,
    status: { id: 'ds-accrued', alias: 'ACCRUED', name_ru: 'Начислено' },
  });
  expect(result.adjustments).toEqual([
    {
      id: 'doc-adj-1',
      accrual_number: 'RA-202603-000002',
      total_amount_rub: '100.00',
      created_at: '2026-03-16T10:00:00.000Z',
      status: { id: 'ds-accrued', alias: 'ACCRUED', name_ru: 'Начислено' },
    },
  ]);
});
