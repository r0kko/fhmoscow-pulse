import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const transactionMock = jest.fn();
const queryMock = jest.fn();

const tournamentFindByPkMock = jest.fn();
const tournamentGroupFindAllMock = jest.fn();
const tournamentGroupRefereeFindAllMock = jest.fn();
const tournamentGroupFindByPkMock = jest.fn();
const refereeRoleFindAllMock = jest.fn();
const refereeRoleFindByPkMock = jest.fn();
const groundFindAllMock = jest.fn();
const groundFindByPkMock = jest.fn();
const matchFindAllMock = jest.fn();
const matchRefereeFindAllMock = jest.fn();
const matchRefereeStatusFindAllMock = jest.fn();

const refereeTariffStatusFindAllMock = jest.fn();
const groundTravelRateStatusFindAllMock = jest.fn();
const refereeAccrualDocumentStatusFindAllMock = jest.fn();
const refereeAccrualSourceFindAllMock = jest.fn();
const refereeAccrualPostingTypeFindAllMock = jest.fn();
const refereeAccrualComponentFindAllMock = jest.fn();
const refereeAccountingActionFindAllMock = jest.fn();
const refereeAccrualStatusTransitionFindOneMock = jest.fn();
const refereeAccrualStatusTransitionFindAllMock = jest.fn();

const refereeTariffRuleFindAllMock = jest.fn();
const refereeTariffRuleFindAndCountAllMock = jest.fn();
const refereeTariffRuleFindOneMock = jest.fn();
const refereeTariffRuleMaxMock = jest.fn();
const refereeTariffRuleCreateMock = jest.fn();
const refereeTariffRuleFindByPkMock = jest.fn();

const groundRefereeTravelRateFindAllMock = jest.fn();
const groundRefereeTravelRateFindOneMock = jest.fn();
const groundRefereeTravelRateCreateMock = jest.fn();

const refereeAccrualDocumentFindOneMock = jest.fn();
const refereeAccrualDocumentCreateMock = jest.fn();
const refereeAccrualDocumentFindAllMock = jest.fn();
const refereeAccrualDocumentFindAndCountAllMock = jest.fn();
const refereeAccrualDocumentFindByPkMock = jest.fn();
const refereeAccrualDocumentCountMock = jest.fn();

const refereeAccrualPostingFindAllMock = jest.fn();
const refereeAccrualPostingBulkCreateMock = jest.fn();
const refereeAccrualPostingDestroyMock = jest.fn();
const accountingAuditEventCreateMock = jest.fn();
const accountingAuditEventFindAllMock = jest.fn();
const groundRefereeTravelRateFindByPkMock = jest.fn();

function refItem(id, alias, extra = {}) {
  return { id, alias, name_ru: alias, ...extra };
}

beforeEach(() => {
  transactionMock.mockReset();
  queryMock.mockReset();

  tournamentFindByPkMock.mockReset();
  tournamentGroupFindAllMock.mockReset();
  tournamentGroupRefereeFindAllMock.mockReset();
  tournamentGroupFindByPkMock.mockReset();
  refereeRoleFindAllMock.mockReset();
  refereeRoleFindByPkMock.mockReset();
  groundFindAllMock.mockReset();
  groundFindByPkMock.mockReset();
  matchFindAllMock.mockReset();
  matchRefereeFindAllMock.mockReset();
  matchRefereeStatusFindAllMock.mockReset();

  refereeTariffStatusFindAllMock.mockReset();
  groundTravelRateStatusFindAllMock.mockReset();
  refereeAccrualDocumentStatusFindAllMock.mockReset();
  refereeAccrualSourceFindAllMock.mockReset();
  refereeAccrualPostingTypeFindAllMock.mockReset();
  refereeAccrualComponentFindAllMock.mockReset();
  refereeAccountingActionFindAllMock.mockReset();
  refereeAccrualStatusTransitionFindOneMock.mockReset();
  refereeAccrualStatusTransitionFindAllMock.mockReset();

  refereeTariffRuleFindAllMock.mockReset();
  refereeTariffRuleFindAndCountAllMock.mockReset();
  refereeTariffRuleFindOneMock.mockReset();
  refereeTariffRuleMaxMock.mockReset();
  refereeTariffRuleCreateMock.mockReset();
  refereeTariffRuleFindByPkMock.mockReset();

  groundRefereeTravelRateFindAllMock.mockReset();
  groundRefereeTravelRateFindOneMock.mockReset();
  groundRefereeTravelRateCreateMock.mockReset();

  refereeAccrualDocumentFindOneMock.mockReset();
  refereeAccrualDocumentCreateMock.mockReset();
  refereeAccrualDocumentFindAllMock.mockReset();
  refereeAccrualDocumentFindAndCountAllMock.mockReset();
  refereeAccrualDocumentFindByPkMock.mockReset();
  refereeAccrualDocumentCountMock.mockReset();

  refereeAccrualPostingFindAllMock.mockReset();
  refereeAccrualPostingBulkCreateMock.mockReset();
  refereeAccrualPostingDestroyMock.mockReset();
  accountingAuditEventCreateMock.mockReset();
  accountingAuditEventFindAllMock.mockReset();
  groundRefereeTravelRateFindByPkMock.mockReset();

  transactionMock.mockImplementation(async (fn) =>
    fn({ LOCK: { UPDATE: 'UPDATE' } })
  );

  refereeTariffStatusFindAllMock.mockResolvedValue([
    refItem('ts-draft', 'DRAFT'),
    refItem('ts-filed', 'FILED'),
    refItem('ts-active', 'ACTIVE'),
    refItem('ts-retired', 'RETIRED'),
  ]);
  groundTravelRateStatusFindAllMock.mockResolvedValue([
    refItem('trs-draft', 'DRAFT'),
    refItem('trs-active', 'ACTIVE'),
    refItem('trs-retired', 'RETIRED'),
  ]);
  refereeAccrualDocumentStatusFindAllMock.mockResolvedValue([
    refItem('ds-draft', 'DRAFT'),
    refItem('ds-accrued', 'ACCRUED'),
    refItem('ds-deleted', 'DELETED'),
  ]);
  refereeAccrualSourceFindAllMock.mockResolvedValue([
    refItem('src-manual', 'MANUAL'),
    refItem('src-cron', 'CRON'),
  ]);
  refereeAccrualPostingTypeFindAllMock.mockResolvedValue([
    refItem('pt-original', 'ORIGINAL'),
    refItem('pt-adjustment', 'ADJUSTMENT'),
    refItem('pt-reversal', 'REVERSAL'),
  ]);
  refereeAccrualComponentFindAllMock.mockResolvedValue([
    refItem('cmp-base', 'BASE'),
    refItem('cmp-meal', 'MEAL'),
    refItem('cmp-travel', 'TRAVEL'),
  ]);
  refereeAccountingActionFindAllMock.mockResolvedValue([
    refItem('act-approve', 'APPROVE', {
      scope: 'ACCRUAL',
      maker_checker_guard: true,
      requires_comment: false,
    }),
    refItem('act-delete', 'DELETE', {
      scope: 'ACCRUAL',
      maker_checker_guard: false,
      requires_comment: true,
    }),
    refItem('act-file', 'FILE', {
      scope: 'TARIFF',
      maker_checker_guard: false,
      requires_comment: false,
    }),
    refItem('act-retire', 'RETIRE', {
      scope: 'TARIFF',
      maker_checker_guard: false,
      requires_comment: false,
    }),
  ]);
  refereeAccrualStatusTransitionFindAllMock.mockResolvedValue([]);

  queryMock.mockResolvedValue([{ last_seq: 1 }]);
  refereeAccrualDocumentCountMock.mockResolvedValue(0);
});

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: {
    transaction: transactionMock,
    query: queryMock,
  },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Tournament: { findByPk: tournamentFindByPkMock },
  TournamentGroup: {
    findByPk: tournamentGroupFindByPkMock,
    findAll: tournamentGroupFindAllMock,
  },
  TournamentGroupReferee: { findAll: tournamentGroupRefereeFindAllMock },
  RefereeRole: {
    findByPk: refereeRoleFindByPkMock,
    findAll: refereeRoleFindAllMock,
  },
  Ground: { findByPk: groundFindByPkMock, findAll: groundFindAllMock },
  Match: { findAll: matchFindAllMock },
  MatchReferee: { findAll: matchRefereeFindAllMock },
  MatchRefereeStatus: { findAll: matchRefereeStatusFindAllMock },
  GameStatus: {},
  User: {},
  Team: {},

  RefereeTariffStatus: { findAll: refereeTariffStatusFindAllMock },
  GroundTravelRateStatus: { findAll: groundTravelRateStatusFindAllMock },
  RefereeAccrualDocumentStatus: {
    findAll: refereeAccrualDocumentStatusFindAllMock,
  },
  RefereeAccrualSource: { findAll: refereeAccrualSourceFindAllMock },
  RefereeAccrualPostingType: { findAll: refereeAccrualPostingTypeFindAllMock },
  RefereeAccrualComponent: { findAll: refereeAccrualComponentFindAllMock },
  RefereeAccountingAction: { findAll: refereeAccountingActionFindAllMock },
  RefereeAccrualStatusTransition: {
    findOne: refereeAccrualStatusTransitionFindOneMock,
    findAll: refereeAccrualStatusTransitionFindAllMock,
  },

  RefereeTariffRule: {
    findAll: refereeTariffRuleFindAllMock,
    findAndCountAll: refereeTariffRuleFindAndCountAllMock,
    findOne: refereeTariffRuleFindOneMock,
    max: refereeTariffRuleMaxMock,
    create: refereeTariffRuleCreateMock,
    findByPk: refereeTariffRuleFindByPkMock,
  },
  GroundRefereeTravelRate: {
    findAll: groundRefereeTravelRateFindAllMock,
    findOne: groundRefereeTravelRateFindOneMock,
    create: groundRefereeTravelRateCreateMock,
    findByPk: groundRefereeTravelRateFindByPkMock,
  },
  RefereeAccrualDocument: {
    findOne: refereeAccrualDocumentFindOneMock,
    create: refereeAccrualDocumentCreateMock,
    findAll: refereeAccrualDocumentFindAllMock,
    findAndCountAll: refereeAccrualDocumentFindAndCountAllMock,
    findByPk: refereeAccrualDocumentFindByPkMock,
    count: refereeAccrualDocumentCountMock,
  },
  RefereeAccrualPosting: {
    findAll: refereeAccrualPostingFindAllMock,
    bulkCreate: refereeAccrualPostingBulkCreateMock,
    destroy: refereeAccrualPostingDestroyMock,
  },
  AccountingAuditEvent: {
    create: accountingAuditEventCreateMock,
    findAll: accountingAuditEventFindAllMock,
  },
}));

const { default: service } =
  await import('../src/services/refereeAccountingService.js');

test('createRefereeTariffRule validates fare code', async () => {
  tournamentFindByPkMock.mockResolvedValue({ id: 't1' });
  tournamentGroupFindByPkMock.mockResolvedValue({
    id: 'g1',
    tournament_id: 't1',
  });
  refereeRoleFindByPkMock.mockResolvedValue({ id: 'r1' });

  await expect(
    service.createRefereeTariffRule(
      't1',
      {
        stage_group_id: 'g1',
        referee_role_id: 'r1',
        fare_code: 'bad-code',
        base_amount_rub: '1000.00',
        meal_amount_rub: '200.00',
        valid_from: '2026-03-01',
      },
      'admin'
    )
  ).rejects.toMatchObject({ code: 'invalid_fare_code' });
});

test('applyRefereeAccrualAction allows same user for simplified APPROVE flow', async () => {
  const updateMock = jest.fn();
  const doc = {
    id: 'doc-1',
    document_status_id: 'ds-draft',
    created_by: 'admin-1',
    get: jest.fn(() => ({ id: 'doc-1', document_status_id: 'ds-draft' })),
    update: updateMock,
  };
  const loadedDoc = {
    id: 'doc-1',
    accrual_number: 'RA-202603-000001',
    DocumentStatus: { alias: 'ACCRUED' },
    Source: { alias: 'MANUAL' },
    Postings: [],
    Adjustments: [],
    get: () => ({ id: 'doc-1', accrual_number: 'RA-202603-000001' }),
  };

  refereeAccrualDocumentFindByPkMock
    .mockResolvedValueOnce(doc)
    .mockResolvedValueOnce(loadedDoc);
  refereeAccrualStatusTransitionFindOneMock.mockResolvedValue({
    id: 'tr-1',
    from_status_id: 'ds-draft',
    action_id: 'act-approve',
    to_status_id: 'ds-accrued',
  });
  accountingAuditEventFindAllMock.mockResolvedValue([]);

  const result = await service.applyRefereeAccrualAction(
    'doc-1',
    'APPROVE',
    'admin-1'
  );

  expect(result.document.id).toBe('doc-1');
  expect(updateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      document_status_id: 'ds-accrued',
      approved_by: 'admin-1',
      updated_by: 'admin-1',
    }),
    expect.any(Object)
  );
});

test('deleteRefereeAccrualDocument allows deleting only draft', async () => {
  refereeAccrualDocumentFindByPkMock.mockResolvedValue({
    id: 'doc-2',
    document_status_id: 'ds-other',
    get: () => ({ id: 'doc-2', document_status_id: 'ds-other' }),
  });

  await expect(
    service.deleteRefereeAccrualDocument(
      'doc-2',
      {
        reason_code: 'USER_DELETE',
        comment: 'test',
      },
      'admin-1'
    )
  ).rejects.toMatchObject({ code: 'accrual_delete_forbidden_status' });
  expect(refereeAccrualPostingDestroyMock).not.toHaveBeenCalled();
});

test('deleteRefereeAccrualDocument marks draft document as deleted without destroying rows', async () => {
  const updateMock = jest.fn();
  const document = {
    id: 'doc-draft',
    document_status_id: 'ds-draft',
    get: () => ({ id: 'doc-draft', document_status_id: 'ds-draft' }),
    update: updateMock,
  };
  refereeAccrualDocumentFindByPkMock
    .mockResolvedValueOnce(document)
    .mockResolvedValueOnce({
      id: 'doc-draft',
      accrual_number: 'RA-202603-000010',
      DocumentStatus: { alias: 'DELETED' },
      Source: { alias: 'MANUAL' },
      Postings: [],
      Adjustments: [],
      get: () => ({ id: 'doc-draft', accrual_number: 'RA-202603-000010' }),
    });
  refereeAccrualPostingFindAllMock.mockResolvedValue([]);
  refereeAccrualDocumentCountMock.mockResolvedValue(0);
  accountingAuditEventFindAllMock.mockResolvedValue([]);

  const result = await service.deleteRefereeAccrualDocument(
    'doc-draft',
    {
      reason_code: 'USER_DELETE',
      comment: 'cleanup',
    },
    'admin-1'
  );

  expect(result.document.id).toBe('doc-draft');
  expect(updateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      document_status_id: 'ds-deleted',
      total_amount_rub: '0.00',
    }),
    expect.any(Object)
  );
  expect(refereeAccrualPostingBulkCreateMock).not.toHaveBeenCalled();
  expect(refereeAccrualPostingDestroyMock).not.toHaveBeenCalled();
});

test('deleteRefereeAccrualDocument adds reversal postings for accrued document and keeps original document', async () => {
  const updateMock = jest.fn();
  const document = {
    id: 'doc-3',
    document_status_id: 'ds-accrued',
    get: () => ({ id: 'doc-3', document_status_id: 'ds-accrued' }),
    update: updateMock,
  };
  refereeAccrualDocumentFindByPkMock
    .mockResolvedValueOnce(document)
    .mockResolvedValueOnce({
      id: 'doc-3',
      accrual_number: 'RA-202603-000003',
      DocumentStatus: { alias: 'DELETED' },
      Source: { alias: 'MANUAL' },
      Postings: [],
      Adjustments: [],
      get: () => ({ id: 'doc-3', accrual_number: 'RA-202603-000003' }),
    });
  refereeAccrualPostingFindAllMock.mockResolvedValue([
    { line_no: 1, component_id: 'cmp-base', amount_rub: '2500.00' },
    { line_no: 2, component_id: 'cmp-meal', amount_rub: '500.00' },
    { line_no: 3, component_id: 'cmp-travel', amount_rub: '750.00' },
  ]);
  refereeAccrualDocumentCountMock.mockResolvedValue(0);
  accountingAuditEventFindAllMock.mockResolvedValue([]);

  const result = await service.deleteRefereeAccrualDocument(
    'doc-3',
    {
      reason_code: 'USER_DELETE',
      comment: 'cleanup',
    },
    'admin-1'
  );

  expect(result.document.id).toBe('doc-3');
  expect(refereeAccrualPostingBulkCreateMock).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        document_id: 'doc-3',
        posting_type_id: 'pt-reversal',
        component_id: 'cmp-base',
        amount_rub: '-2500.00',
        line_no: 4,
      }),
      expect.objectContaining({
        document_id: 'doc-3',
        posting_type_id: 'pt-reversal',
        component_id: 'cmp-meal',
        amount_rub: '-500.00',
        line_no: 5,
      }),
      expect.objectContaining({
        document_id: 'doc-3',
        posting_type_id: 'pt-reversal',
        component_id: 'cmp-travel',
        amount_rub: '-750.00',
        line_no: 6,
      }),
    ]),
    expect.any(Object)
  );
  expect(updateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      document_status_id: 'ds-deleted',
      base_amount_rub: '0.00',
      meal_amount_rub: '0.00',
      travel_amount_rub: '0.00',
      total_amount_rub: '0.00',
    }),
    expect.any(Object)
  );
  expect(refereeAccrualPostingDestroyMock).not.toHaveBeenCalled();
});

test('deleteRefereeAccrualDocument rejects documents that already have adjustment postings', async () => {
  refereeAccrualDocumentFindByPkMock.mockResolvedValue({
    id: 'doc-adjusted',
    document_status_id: 'ds-accrued',
    get: () => ({ id: 'doc-adjusted', document_status_id: 'ds-accrued' }),
  });
  refereeAccrualDocumentCountMock.mockResolvedValue(0);
  refereeAccrualPostingFindAllMock.mockResolvedValue([
    {
      line_no: 1,
      posting_type_id: 'pt-adjustment',
      component_id: 'cmp-base',
      amount_rub: '100.00',
    },
  ]);

  await expect(
    service.deleteRefereeAccrualDocument(
      'doc-adjusted',
      {
        reason_code: 'USER_DELETE',
        comment: 'cleanup',
      },
      'admin-1'
    )
  ).rejects.toMatchObject({ code: 'accrual_delete_has_adjustments' });
});

test('generateAccruals returns error breakdown when tariff is missing', async () => {
  matchRefereeStatusFindAllMock.mockResolvedValue([
    { id: 's1', alias: 'PUBLISHED' },
    { id: 's2', alias: 'CONFIRMED' },
  ]);
  matchFindAllMock.mockResolvedValue([
    {
      id: 'm1',
      tournament_id: 't1',
      tournament_group_id: 'g1',
      ground_id: 'gr1',
      date_start: '2026-03-01T10:00:00.000Z',
    },
  ]);
  matchRefereeFindAllMock.mockResolvedValue([
    {
      id: 'mr1',
      match_id: 'm1',
      referee_role_id: 'rr1',
      user_id: 'u1',
      status_id: 's1',
    },
  ]);

  refereeAccrualDocumentFindAllMock.mockResolvedValue([]);
  refereeTariffRuleFindOneMock.mockResolvedValue(null);

  const result = await service.generateAccruals({
    tournamentId: null,
    fromDate: '2026-03-01',
    toDate: '2026-03-01',
    apply: false,
    source: 'MANUAL',
  });

  expect(result.summary.eligible_assignments).toBe(1);
  expect(result.summary.created).toBe(0);
  expect(result.summary.errors).toBe(1);
  expect(result.errors_by_code).toEqual({ missing_tariff_rule: 1 });
});

test('generateAccruals apply=true creates document and postings for valid data', async () => {
  matchRefereeStatusFindAllMock.mockResolvedValue([
    { id: 's1', alias: 'PUBLISHED' },
    { id: 's2', alias: 'CONFIRMED' },
  ]);
  matchFindAllMock.mockResolvedValue([
    {
      id: 'm1',
      tournament_id: 't1',
      tournament_group_id: 'g1',
      ground_id: 'gr1',
      date_start: '2026-03-01T10:00:00.000Z',
    },
  ]);
  matchRefereeFindAllMock.mockResolvedValue([
    {
      id: 'mr1',
      match_id: 'm1',
      referee_role_id: 'rr1',
      user_id: 'u1',
      status_id: 's1',
    },
  ]);

  refereeAccrualDocumentFindAllMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: 'doc-1',
        accrual_number: 'RA-202603-000001',
      },
    ]);
  refereeAccrualDocumentFindOneMock.mockResolvedValue(null);

  refereeTariffRuleFindOneMock.mockResolvedValue({
    id: 'tariff-1',
    fare_code: 'A1',
    base_amount_rub: '2500.00',
    meal_amount_rub: '500.00',
  });
  groundRefereeTravelRateFindOneMock.mockResolvedValue({
    id: 'travel-1',
    travel_amount_rub: '750.00',
  });

  refereeAccrualDocumentCreateMock.mockImplementation(async (payload) => ({
    ...payload,
    id: 'doc-1',
    get: () => ({ ...payload, id: 'doc-1' }),
  }));

  const result = await service.generateAccruals({
    tournamentId: null,
    fromDate: '2026-03-01',
    toDate: '2026-03-01',
    apply: true,
    source: 'MANUAL',
    actorId: 'admin-1',
  });

  expect(result.summary.eligible_assignments).toBe(1);
  expect(result.summary.calculated).toBe(1);
  expect(refereeAccrualDocumentCreateMock).toHaveBeenCalledTimes(1);
  expect(refereeAccrualPostingBulkCreateMock).toHaveBeenCalledTimes(1);
  expect(String(queryMock.mock.calls[0]?.[0] || '')).toContain('current_max');
});

test('generateAccruals treats deleted original documents as existing and does not recreate them', async () => {
  matchRefereeStatusFindAllMock.mockResolvedValue([
    { id: 's1', alias: 'PUBLISHED' },
  ]);
  matchFindAllMock.mockResolvedValue([
    {
      id: 'm1',
      tournament_id: 't1',
      tournament_group_id: 'g1',
      ground_id: 'gr1',
      date_start: '2026-03-01T10:00:00.000Z',
    },
  ]);
  matchRefereeFindAllMock.mockResolvedValue([
    {
      id: 'mr1',
      match_id: 'm1',
      referee_role_id: 'rr1',
      user_id: 'u1',
      status_id: 's1',
    },
  ]);
  refereeAccrualDocumentFindAllMock.mockResolvedValue([
    { match_referee_id: 'mr1' },
  ]);

  const result = await service.generateAccruals({
    tournamentId: null,
    fromDate: '2026-03-01',
    toDate: '2026-03-01',
    apply: false,
    source: 'CRON',
  });

  expect(result.summary.skipped_existing).toBe(1);
  expect(refereeAccrualDocumentFindAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      paranoid: false,
    })
  );
  expect(refereeAccrualDocumentCreateMock).not.toHaveBeenCalled();
});

test('listRefereeAccrualDocuments extends search to original number and related fields', async () => {
  refereeAccrualDocumentFindAndCountAllMock.mockResolvedValue({
    rows: [],
    count: 0,
  });

  await service.listRefereeAccrualDocuments({
    search: 'RA-202603-000001',
    page: 1,
    limit: 20,
  });

  expect(refereeAccrualDocumentFindAndCountAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.arrayContaining([
        expect.objectContaining({ as: 'OriginalDocument' }),
      ]),
    })
  );
  const args = refereeAccrualDocumentFindAndCountAllMock.mock.calls[0][0];
  expect(args.where[Op.or]).toEqual(
    expect.arrayContaining([
      {
        '$OriginalDocument.accrual_number$': {
          [Op.iLike]: '%RA-202603-000001%',
        },
      },
    ])
  );
});

test('getRefereeAccrualDocument loads original document and adjustments for detail chain', async () => {
  refereeAccrualDocumentFindByPkMock.mockResolvedValue({
    id: 'doc-1',
    Adjustments: [],
    get: () => ({ id: 'doc-1' }),
  });
  accountingAuditEventFindAllMock.mockResolvedValue([]);

  await service.getRefereeAccrualDocument('doc-1');

  expect(refereeAccrualDocumentFindByPkMock).toHaveBeenCalledWith(
    'doc-1',
    expect.objectContaining({
      include: expect.arrayContaining([
        expect.objectContaining({ as: 'OriginalDocument' }),
        expect.objectContaining({ as: 'Adjustments' }),
      ]),
    })
  );
});

test('createRefereeAccrualAdjustment locks source document without JOIN include', async () => {
  const sourceDoc = {
    id: 'doc-source',
    document_status_id: 'ds-accrued',
    get: jest.fn(() => ({
      id: 'doc-source',
      document_status_id: 'ds-accrued',
      total_amount_rub: '3750.00',
    })),
    update: jest.fn(),
  };
  const loadedDoc = {
    id: 'doc-source',
    accrual_number: 'RA-202603-000002',
    DocumentStatus: { alias: 'ACCRUED' },
    Source: { alias: 'MANUAL' },
    Postings: [],
    Adjustments: [],
    get: () => ({
      id: 'doc-source',
      accrual_number: 'RA-202603-000002',
    }),
  };

  refereeAccrualDocumentFindByPkMock
    .mockResolvedValueOnce(sourceDoc)
    .mockResolvedValueOnce(loadedDoc);
  refereeAccrualPostingFindAllMock.mockResolvedValue([
    { line_no: 1, component_id: 'cmp-base', amount_rub: '2500.00' },
    { line_no: 2, component_id: 'cmp-meal', amount_rub: '500.00' },
    { line_no: 3, component_id: 'cmp-travel', amount_rub: '750.00' },
  ]);
  accountingAuditEventFindAllMock.mockResolvedValue([]);

  const result = await service.createRefereeAccrualAdjustment(
    'doc-source',
    {
      base_amount_rub: '100,00',
      meal_amount_rub: '0,00',
      travel_amount_rub: '0,00',
      reason_code: 'FIX',
      comment: 'test',
    },
    'admin-1'
  );

  expect(result.document.id).toBe('doc-source');
  expect(refereeAccrualDocumentFindByPkMock).toHaveBeenNthCalledWith(
    1,
    'doc-source',
    expect.objectContaining({
      lock: 'UPDATE',
      transaction: expect.any(Object),
    })
  );
  const firstCallOptions = refereeAccrualDocumentFindByPkMock.mock.calls[0][1];
  expect(firstCallOptions.include).toBeUndefined();
  expect(refereeAccrualDocumentCreateMock).not.toHaveBeenCalled();
});

test('createRefereeAccrualAdjustment appends adjustment postings and recalculates the same document', async () => {
  const updateMock = jest.fn();
  const sourceDoc = {
    id: 'doc-root',
    document_status_id: 'ds-accrued',
    get: jest.fn(() => ({
      id: 'doc-root',
      base_amount_rub: '2500.00',
      meal_amount_rub: '500.00',
      travel_amount_rub: '750.00',
      total_amount_rub: '3750.00',
    })),
    update: updateMock,
  };
  const loadedDoc = {
    id: 'doc-root',
    accrual_number: 'RA-202603-000003',
    DocumentStatus: { alias: 'ACCRUED' },
    Source: { alias: 'MANUAL' },
    Postings: [],
    Adjustments: [],
    get: () => ({ id: 'doc-root' }),
  };

  refereeAccrualDocumentFindByPkMock
    .mockResolvedValueOnce(sourceDoc)
    .mockResolvedValueOnce(loadedDoc);
  refereeAccrualPostingFindAllMock.mockResolvedValue([
    { line_no: 1, component_id: 'cmp-base', amount_rub: '2500.00' },
    { line_no: 2, component_id: 'cmp-meal', amount_rub: '500.00' },
    { line_no: 3, component_id: 'cmp-travel', amount_rub: '750.00' },
  ]);
  accountingAuditEventFindAllMock.mockResolvedValue([]);

  const result = await service.createRefereeAccrualAdjustment(
    'doc-root',
    {
      base_amount_rub: '100,00',
      meal_amount_rub: '0,00',
      travel_amount_rub: '0,00',
      reason_code: 'FIX',
      comment: 'root',
    },
    'admin-1'
  );

  expect(result.document.id).toBe('doc-root');
  expect(refereeAccrualPostingBulkCreateMock).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        document_id: 'doc-root',
        posting_type_id: 'pt-adjustment',
        component_id: 'cmp-base',
        amount_rub: '100.00',
        line_no: 4,
      }),
    ]),
    expect.any(Object)
  );
  expect(updateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      base_amount_rub: '2600.00',
      meal_amount_rub: '500.00',
      travel_amount_rub: '750.00',
      total_amount_rub: '3850.00',
      document_status_id: 'ds-accrued',
    }),
    expect.any(Object)
  );
});

test('createRefereeAccrualAdjustment rejects draft source document', async () => {
  refereeAccrualDocumentFindByPkMock.mockResolvedValue({
    id: 'doc-draft',
    original_document_id: null,
    document_status_id: 'ds-draft',
  });

  await expect(
    service.createRefereeAccrualAdjustment(
      'doc-draft',
      {
        base_amount_rub: '100,00',
        meal_amount_rub: '0,00',
        travel_amount_rub: '0,00',
        reason_code: 'FIX',
      },
      'admin-1'
    )
  ).rejects.toMatchObject({ code: 'accrual_adjustment_forbidden_status' });
});

test('getTournamentPaymentsDashboard aggregates coverage and issue lists', async () => {
  tournamentFindByPkMock.mockResolvedValue({ id: 't1' });
  tournamentGroupFindAllMock.mockResolvedValue([
    { id: 'g1', name: 'Группа А' },
    { id: 'g2', name: 'Группа Б' },
  ]);
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    { tournament_group_id: 'g1', referee_role_id: 'r1', count: 1 },
    { tournament_group_id: 'g2', referee_role_id: 'r1', count: 1 },
    { tournament_group_id: 'g1', referee_role_id: 'r2', count: 1 },
  ]);
  refereeRoleFindAllMock.mockResolvedValue([
    { id: 'r1', name: 'Главный' },
    { id: 'r2', name: 'Линейный' },
  ]);
  matchFindAllMock.mockResolvedValue([
    {
      id: 'm1',
      tournament_group_id: 'g1',
      ground_id: 'gr1',
      date_start: '2026-03-15T10:00:00.000Z',
    },
    {
      id: 'm2',
      tournament_group_id: 'g2',
      ground_id: 'gr2',
      date_start: '2026-03-16T10:00:00.000Z',
    },
  ]);
  refereeTariffRuleFindAllMock.mockResolvedValue([
    {
      id: 'tariff-1',
      stage_group_id: 'g1',
      referee_role_id: 'r1',
      valid_from: '2026-03-01',
      valid_to: '2026-03-31',
      tariff_status_id: 'ts-active',
    },
    {
      id: 'tariff-2',
      stage_group_id: 'g2',
      referee_role_id: 'r1',
      valid_from: '2026-02-01',
      valid_to: '2026-02-28',
      tariff_status_id: 'ts-active',
    },
  ]);
  groundFindAllMock.mockResolvedValue([{ id: 'gr1', name: 'Арена 1' }]);
  groundRefereeTravelRateFindAllMock.mockResolvedValue([
    {
      id: 'travel-1',
      ground_id: 'gr1',
      valid_from: '2026-03-01',
      valid_to: '2026-03-31',
      travel_rate_status_id: 'trs-active',
    },
    {
      id: 'travel-2',
      ground_id: 'gr2',
      valid_from: '2026-02-01',
      valid_to: '2026-02-28',
      travel_rate_status_id: 'trs-active',
    },
  ]);
  refereeAccrualDocumentCountMock.mockResolvedValue(3);

  const result = await service.getTournamentPaymentsDashboard({
    tournamentId: 't1',
    onDate: '2026-03-15',
  });

  expect(result.coverage_date).toBe('2026-03-15');
  expect(result.summary).toEqual(
    expect.objectContaining({
      active_tariff_rules: 2,
      active_travel_rates: 2,
      draft_accruals: 3,
    })
  );
  expect(result.tariff_coverage_summary).toEqual({
    total: 2,
    ok: 1,
    out_of_period: 0,
    missing: 1,
  });
  expect(result.tariff_coverage_issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        stage_group_id: 'g1',
        referee_role_id: 'r2',
        state: 'missing',
      }),
    ])
  );
  expect(result.travel_coverage_summary).toEqual({
    total: 1,
    ok: 1,
    out_of_period: 0,
    missing: 0,
  });
  expect(
    result.tariff_coverage_issues.some((row) => row.stage_group_id === 'g2')
  ).toBe(false);
  expect(
    result.travel_coverage_rows.some((row) => row.ground_id === 'gr2')
  ).toBe(false);
  expect(groundFindAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: { [Op.in]: ['gr1'] } },
    })
  );
});

test('listRefereeTariffRules allows extended coverage limit without truncation error', async () => {
  tournamentFindByPkMock.mockResolvedValue({ id: 't1' });
  refereeTariffRuleFindAndCountAllMock.mockResolvedValue({
    rows: [],
    count: 0,
  });

  await service.listRefereeTariffRules({
    tournamentId: 't1',
    page: 1,
    limit: 3000,
  });

  expect(refereeTariffRuleFindAndCountAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      limit: 3000,
      offset: 0,
    })
  );
});

test('createRefereeTariffRule always creates active tariff rules', async () => {
  tournamentFindByPkMock.mockResolvedValue({ id: 't1' });
  tournamentGroupFindByPkMock.mockResolvedValue({
    id: 'g1',
    tournament_id: 't1',
  });
  refereeRoleFindByPkMock.mockResolvedValue({ id: 'r1' });
  refereeTariffRuleMaxMock.mockResolvedValue(2);
  refereeTariffRuleFindAllMock.mockResolvedValue([]);
  refereeTariffRuleCreateMock.mockResolvedValue({
    id: 'tariff-1',
    get: () => ({ id: 'tariff-1' }),
  });
  refereeTariffRuleFindByPkMock.mockResolvedValue({
    id: 'tariff-1',
    TariffStatus: { alias: 'ACTIVE' },
  });

  await service.createRefereeTariffRule(
    't1',
    {
      stage_group_id: 'g1',
      referee_role_id: 'r1',
      fare_code: 'A1',
      base_amount_rub: '1000.00',
      meal_amount_rub: '200.00',
      valid_from: '2026-03-01',
      status: 'RETIRED',
    },
    'admin-1'
  );

  expect(refereeTariffRuleCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      tariff_status_id: 'ts-active',
      version: 3,
    })
  );
});

test('updateRefereeTariffRule rejects editing business fields for tariffs used in live accruals', async () => {
  refereeTariffRuleFindOneMock.mockResolvedValue({
    id: 'tariff-1',
    tournament_id: 't1',
    stage_group_id: 'g1',
    referee_role_id: 'r1',
    fare_code: 'A1',
    base_amount_rub: '1000.00',
    meal_amount_rub: '200.00',
    valid_from: '2026-03-01',
    valid_to: null,
    get: () => ({ id: 'tariff-1' }),
  });
  refereeAccrualDocumentCountMock.mockResolvedValue(1);

  await expect(
    service.updateRefereeTariffRule(
      't1',
      'tariff-1',
      {
        base_amount_rub: '1200.00',
      },
      'admin-1'
    )
  ).rejects.toMatchObject({ code: 'tariff_rule_locked_by_accruals' });
});

test('retireRefereeTariffRule archives tariff row instead of deleting it', async () => {
  const updateMock = jest.fn();
  refereeTariffRuleFindOneMock.mockResolvedValue({
    id: 'tariff-1',
    tournament_id: 't1',
    stage_group_id: 'g1',
    referee_role_id: 'r1',
    fare_code: 'A1',
    base_amount_rub: '1000.00',
    meal_amount_rub: '200.00',
    valid_from: '2026-03-01',
    valid_to: null,
    TariffStatus: { alias: 'ACTIVE' },
    get: () => ({ id: 'tariff-1', valid_to: null }),
    update: updateMock,
  });
  refereeAccrualDocumentCountMock.mockResolvedValue(0);
  refereeTariffRuleFindByPkMock.mockResolvedValue({
    id: 'tariff-1',
    TariffStatus: { alias: 'RETIRED', name_ru: 'Архив' },
    get: () => ({ id: 'tariff-1' }),
  });

  await service.retireRefereeTariffRule('t1', 'tariff-1', 'admin-1');

  expect(updateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      tariff_status_id: 'ts-retired',
      valid_to: expect.any(String),
    }),
    expect.any(Object)
  );
});

test('updateGroundTravelRate rejects editing business fields for rates used in live accruals', async () => {
  groundRefereeTravelRateFindOneMock.mockResolvedValue({
    id: 'travel-1',
    ground_id: 'gr1',
    rate_code: 'TRV1',
    travel_amount_rub: '350.00',
    valid_from: '2026-03-01',
    valid_to: null,
    get: () => ({ id: 'travel-1' }),
  });
  refereeAccrualDocumentCountMock.mockResolvedValue(1);

  await expect(
    service.updateGroundTravelRate(
      'gr1',
      'travel-1',
      {
        travel_amount_rub: '500.00',
      },
      'admin-1'
    )
  ).rejects.toMatchObject({ code: 'travel_rate_locked_by_accruals' });
});

test('updateGroundTravelRate archives rate row instead of deleting it', async () => {
  const updateMock = jest.fn();
  groundRefereeTravelRateFindOneMock.mockResolvedValue({
    id: 'travel-1',
    ground_id: 'gr1',
    rate_code: 'TRV1',
    travel_amount_rub: '350.00',
    valid_from: '2026-03-01',
    valid_to: null,
    TravelRateStatus: { alias: 'ACTIVE' },
    get: () => ({ id: 'travel-1', valid_to: null }),
    update: updateMock,
  });
  refereeAccrualDocumentCountMock.mockResolvedValue(0);
  groundRefereeTravelRateFindByPkMock.mockResolvedValue({
    id: 'travel-1',
    TravelRateStatus: { alias: 'RETIRED', name_ru: 'Архив' },
    get: () => ({ id: 'travel-1' }),
  });

  await service.updateGroundTravelRate(
    'gr1',
    'travel-1',
    {
      status: 'RETIRED',
    },
    'admin-1'
  );

  expect(updateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      travel_rate_status_id: 'trs-retired',
      valid_to: expect.any(String),
    }),
    expect.any(Object)
  );
});

test('generateAccruals resolves retired tariffs and travel rates for historical windows', async () => {
  matchRefereeStatusFindAllMock.mockResolvedValue([
    { id: 's1', alias: 'PUBLISHED' },
  ]);
  matchFindAllMock.mockResolvedValue([
    {
      id: 'm1',
      tournament_id: 't1',
      tournament_group_id: 'g1',
      ground_id: 'gr1',
      date_start: '2026-03-01T10:00:00.000Z',
    },
  ]);
  matchRefereeFindAllMock.mockResolvedValue([
    {
      id: 'mr1',
      match_id: 'm1',
      referee_role_id: 'rr1',
      user_id: 'u1',
      status_id: 's1',
    },
  ]);
  refereeAccrualDocumentFindAllMock.mockResolvedValue([]);
  refereeTariffRuleFindOneMock.mockResolvedValue({
    id: 'tariff-1',
    fare_code: 'A1',
    base_amount_rub: '2500.00',
    meal_amount_rub: '500.00',
  });
  groundRefereeTravelRateFindOneMock.mockResolvedValue({
    id: 'travel-1',
    travel_amount_rub: '750.00',
  });

  await service.generateAccruals({
    tournamentId: null,
    fromDate: '2026-03-01',
    toDate: '2026-03-01',
    apply: false,
    source: 'MANUAL',
  });

  expect(refereeTariffRuleFindOneMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        tariff_status_id: { [Op.in]: ['ts-active', 'ts-retired'] },
      }),
    })
  );
  expect(groundRefereeTravelRateFindOneMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        travel_rate_status_id: { [Op.in]: ['trs-active', 'trs-retired'] },
      }),
    })
  );
});

test('getTournamentPaymentsDashboard treats retired tariff and travel rates as historical coverage', async () => {
  tournamentFindByPkMock.mockResolvedValue({ id: 't1' });
  tournamentGroupFindAllMock.mockResolvedValue([
    { id: 'g1', name: 'Группа А' },
  ]);
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    { tournament_group_id: 'g1', referee_role_id: 'r1', count: 1 },
  ]);
  refereeRoleFindAllMock.mockResolvedValue([{ id: 'r1', name: 'Главный' }]);
  matchFindAllMock.mockResolvedValue([
    {
      id: 'm1',
      tournament_group_id: 'g1',
      ground_id: 'gr1',
      date_start: '2026-03-15T10:00:00.000Z',
    },
  ]);
  refereeTariffRuleFindAllMock.mockResolvedValue([
    {
      id: 'tariff-1',
      stage_group_id: 'g1',
      referee_role_id: 'r1',
      valid_from: '2026-03-01',
      valid_to: '2026-03-31',
      tariff_status_id: 'ts-retired',
    },
  ]);
  groundFindAllMock.mockResolvedValue([{ id: 'gr1', name: 'Арена 1' }]);
  groundRefereeTravelRateFindAllMock.mockResolvedValue([
    {
      id: 'travel-1',
      ground_id: 'gr1',
      valid_from: '2026-03-01',
      valid_to: '2026-03-31',
      travel_rate_status_id: 'trs-retired',
    },
  ]);
  refereeAccrualDocumentCountMock.mockResolvedValue(0);

  const result = await service.getTournamentPaymentsDashboard({
    tournamentId: 't1',
    onDate: '2026-03-15',
  });

  expect(result.tariff_coverage_summary.ok).toBe(1);
  expect(result.travel_coverage_summary.ok).toBe(1);
});
