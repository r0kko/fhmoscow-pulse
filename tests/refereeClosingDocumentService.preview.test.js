import { beforeEach, expect, jest, test } from '@jest/globals';

const tournamentFindByPk = jest.fn();
const tournamentFindAll = jest.fn();
const closingProfileFindOne = jest.fn();
const closingDocumentCreate = jest.fn();
const closingDocumentFindOne = jest.fn();
const closingDocumentFindAll = jest.fn();
const closingDocumentFindAndCountAll = jest.fn();
const closingDocumentCount = jest.fn();
const createAsyncJob = jest.fn();
const registeredClosingJobHandlers = new Map();
const registerAsyncJobHandler = jest.fn((jobType, operation, handler) => {
  registeredClosingJobHandlers.set(`${jobType}:${operation}`, handler);
});
const accrualStatusFindOne = jest.fn();
const accrualFindAll = jest.fn();
const accrualFindAndCountAll = jest.fn();
const userSignTypeFindAll = jest.fn();
const userSignTypeFindOne = jest.fn();
const documentTypeFindOne = jest.fn();
const documentStatusFindOne = jest.fn();
const signTypeFindOne = jest.fn();
const documentFindAll = jest.fn();
const documentCreate = jest.fn();
const documentFindByPk = jest.fn();
const documentUserSignFindOne = jest.fn();
const documentUserSignDestroy = jest.fn();
const innFindAll = jest.fn();
const taxationFindAll = jest.fn();
const bankAccountFindAll = jest.fn();
const userAddressFindAll = jest.fn();
const refereeAccrualUpdate = jest.fn();
const closingItemDestroy = jest.fn();
const closingItemUpdate = jest.fn();
const closingItemCreate = jest.fn();
const closingItemFindAll = jest.fn();
const accountingAuditCreate = jest.fn();
const saveGeneratedPdf = jest.fn();
const getDownloadUrl = jest.fn();
const removeFile = jest.fn();
const sequelizeTransaction = jest.fn();
const listRefereeAccrualDocuments = jest.fn();
const documentServiceRegenerate = jest.fn();
const documentServiceSign = jest.fn();
const documentServiceSendAwaitingNotification = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Tournament: { findByPk: tournamentFindByPk, findAll: tournamentFindAll },
  User: {},
  Role: {},
  UserStatus: {},
  SignType: { findOne: signTypeFindOne },
  UserSignType: { findAll: userSignTypeFindAll, findOne: userSignTypeFindOne },
  DocumentType: { findOne: documentTypeFindOne },
  DocumentStatus: { findOne: documentStatusFindOne },
  Document: {
    findAll: documentFindAll,
    create: documentCreate,
    findByPk: documentFindByPk,
  },
  DocumentUserSign: {
    findAll: jest.fn(),
    findOne: documentUserSignFindOne,
    destroy: documentUserSignDestroy,
  },
  File: {},
  Team: {},
  Match: {},
  Ground: {},
  RefereeRole: {},
  TournamentGroup: {},
  RefereeAccrualDocument: {
    findAll: accrualFindAll,
    findAndCountAll: accrualFindAndCountAll,
    update: refereeAccrualUpdate,
  },
  RefereeAccrualDocumentStatus: { findOne: accrualStatusFindOne },
  RefereeClosingDocumentProfile: { findOne: closingProfileFindOne },
  RefereeClosingDocument: {
    findAll: closingDocumentFindAll,
    findAndCountAll: closingDocumentFindAndCountAll,
    count: closingDocumentCount,
    findOne: closingDocumentFindOne,
    create: closingDocumentCreate,
  },
  RefereeClosingDocumentItem: {
    findAll: closingItemFindAll,
    destroy: closingItemDestroy,
    update: closingItemUpdate,
    create: closingItemCreate,
  },
  Address: {},
  AddressType: {},
  Inn: { findAll: innFindAll },
  Taxation: { findAll: taxationFindAll },
  TaxationType: {},
  BankAccount: { findAll: bankAccountFindAll },
  UserAddress: { findAll: userAddressFindAll },
  AccountingAuditEvent: { create: accountingAuditCreate },
}));

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: sequelizeTransaction },
}));

jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: {
    saveGeneratedPdf,
    getDownloadUrl,
    removeFile,
  },
}));

jest.unstable_mockModule('../src/services/refereeAccountingService.js', () => ({
  __esModule: true,
  default: {
    listRefereeAccrualDocuments,
  },
}));

jest.unstable_mockModule('../src/utils/redisLock.js', () => ({
  __esModule: true,
  buildJobLockKey: (name) => `job:${name}`,
  withRedisLock: async (_key, _ttl, fn) => fn(),
}));

jest.unstable_mockModule('../src/services/asyncJobService.js', () => ({
  __esModule: true,
  buildAsyncJobDedupeKey: (payload) => JSON.stringify(payload),
  createAsyncJob,
  default: {
    createAsyncJob,
  },
}));

jest.unstable_mockModule('../src/services/asyncJobRegistry.js', () => ({
  __esModule: true,
  registerAsyncJobHandler,
  default: {
    registerAsyncJobHandler,
  },
}));

jest.unstable_mockModule('../src/services/documentService.js', () => ({
  __esModule: true,
  default: {
    regenerate: documentServiceRegenerate,
    sign: documentServiceSign,
    sendAwaitingSignatureNotification: documentServiceSendAwaitingNotification,
  },
}));

const { default: closingService } =
  await import('../src/services/refereeClosingDocumentService.js');

beforeEach(() => {
  tournamentFindByPk.mockReset();
  tournamentFindAll.mockReset();
  closingProfileFindOne.mockReset();
  closingDocumentCreate.mockReset();
  accrualStatusFindOne.mockReset();
  accrualFindAll.mockReset();
  accrualFindAndCountAll.mockReset();
  userSignTypeFindAll.mockReset();
  userSignTypeFindOne.mockReset();
  documentTypeFindOne.mockReset();
  documentStatusFindOne.mockReset();
  signTypeFindOne.mockReset();
  documentFindAll.mockReset();
  documentCreate.mockReset();
  documentFindByPk.mockReset();
  documentUserSignFindOne.mockReset();
  documentUserSignDestroy.mockReset();
  innFindAll.mockReset();
  taxationFindAll.mockReset();
  bankAccountFindAll.mockReset();
  userAddressFindAll.mockReset();
  closingDocumentFindOne.mockReset();
  closingDocumentFindAll.mockReset();
  closingDocumentFindAndCountAll.mockReset();
  closingDocumentCount.mockReset();
  createAsyncJob.mockReset();
  refereeAccrualUpdate.mockReset();
  closingItemDestroy.mockReset();
  closingItemUpdate.mockReset();
  closingItemCreate.mockReset();
  closingItemFindAll.mockReset();
  accountingAuditCreate.mockReset();
  saveGeneratedPdf.mockReset();
  getDownloadUrl.mockReset();
  removeFile.mockReset();
  sequelizeTransaction.mockReset();
  listRefereeAccrualDocuments.mockReset();
  documentServiceRegenerate.mockReset();
  documentServiceSign.mockReset();
  documentServiceSendAwaitingNotification.mockReset();
  sequelizeTransaction.mockImplementation(async (callback) =>
    callback({ LOCK: { UPDATE: 'UPDATE' } })
  );
  closingDocumentFindAll.mockResolvedValue([]);
  closingDocumentFindAndCountAll.mockResolvedValue({ rows: [], count: 0 });
  closingDocumentCount.mockResolvedValue(0);
  createAsyncJob.mockImplementation(async (payload) => ({
    job_id: 'closing-job-1',
    job_type: payload.jobType,
    operation: 'CREATE_DRAFTS',
    queue: payload.queue,
    scope_type: payload.scopeType,
    scope_id: payload.scopeId,
    status: 'QUEUED',
    total_count: payload.items?.length || 0,
    processed_count: 0,
    success_count: 0,
    skipped_count: 0,
    failure_count: 0,
    progress_percent: 0,
  }));
  closingItemFindAll.mockResolvedValue([]);
  bankAccountFindAll.mockResolvedValue([]);
});

function validBankAccount(userId = 'ref-1') {
  return {
    user_id: userId,
    number: '40702810900000005555',
    bic: '044525225',
    bank_name: 'ПАО Сбербанк',
    correspondent_account: '30101810400000000225',
    inn: '7707083893',
    kpp: '773601001',
    address: 'г. Москва, ул. Вавилова, д. 19',
  };
}

function mockFhmoSigner() {
  userSignTypeFindAll.mockResolvedValue([
    {
      User: {
        id: 'fhmo-1',
        email: 'fhmo@example.com',
        last_name: 'Дробот',
        first_name: 'Алексей',
        patronymic: 'Андреевич',
        Roles: [
          {
            alias: 'FHMO_JUDGING_LEAD_SPECIALIST',
            name: 'Ведущий специалист по судейству',
            departmentName: 'Судейский департамент',
            displayOrder: 1,
          },
        ],
      },
      SignType: { alias: 'SIMPLE_ELECTRONIC' },
    },
  ]);
}

function getRegisteredClosingJobHandler(operation) {
  return (
    registeredClosingJobHandlers.get(
      `REFEREE_CLOSING_DOCUMENTS:${operation}`
    ) || null
  );
}

test('preview blocks act creation when referee address is missing', async () => {
  tournamentFindByPk.mockResolvedValue({
    id: 'tour-1',
    name: 'Кубок Москвы',
  });
  closingProfileFindOne.mockResolvedValue({
    id: 'profile-1',
    organizer_inn: '7708046206',
    organizer_name: 'Федерация хоккея Москвы',
    organizer_short_name: 'ФХМ',
    organizer_kpp: '770101001',
    organizer_ogrn: '1234567890123',
    organizer_address: 'Москва, Кривоколенный пер., д. 9',
    last_verified_at: new Date('2026-03-12T10:00:00Z'),
  });
  accrualStatusFindOne.mockResolvedValue({ id: 'status-accrued' });
  accrualFindAll.mockResolvedValue([
    {
      id: 'acc-1',
      referee_id: 'ref-1',
      document_status_id: 'status-accrued',
      accrual_number: 'A-001',
      match_date_snapshot: '2026-03-01',
      fare_code_snapshot: 'RPOT',
      total_amount_rub: '1500.00',
      base_amount_rub: '1500.00',
      meal_amount_rub: '0.00',
      travel_amount_rub: '0.00',
      Referee: {
        id: 'ref-1',
        email: 'judge@example.com',
        last_name: 'Судья',
        first_name: 'Иван',
        patronymic: 'Иванович',
      },
      RefereeRole: { name: 'Главный судья' },
      Tournament: { name: 'Кубок Москвы' },
      TournamentGroup: null,
      Ground: null,
      Match: {
        HomeTeam: { name: 'Команда А' },
        AwayTeam: { name: 'Команда Б' },
      },
      ClosingItem: null,
    },
  ]);
  userSignTypeFindAll
    .mockResolvedValueOnce([
      {
        User: {
          id: 'fhmo-1',
          email: 'fhmo@example.com',
          last_name: 'Дробот',
          first_name: 'Алексей',
          patronymic: 'Андреевич',
          Roles: [
            {
              alias: 'FHMO_JUDGING_LEAD_SPECIALIST',
              name: 'Ведущий специалист по судейству',
              departmentName: 'Судейский департамент',
              displayOrder: 1,
            },
          ],
        },
      },
    ])
    .mockResolvedValueOnce([
      {
        user_id: 'ref-1',
        SignType: { alias: 'SIMPLE_ELECTRONIC', name: 'ПЭП' },
      },
    ]);
  documentFindAll
    .mockResolvedValueOnce([
      {
        recipient_id: 'ref-1',
      },
    ])
    .mockResolvedValueOnce([
      {
        id: 'contract-1',
        recipient_id: 'ref-1',
        number: '26.03/1024',
        document_date: '2026-03-12',
        name: 'Заявление о присоединении к условиям договора',
        DocumentType: { name: 'Заявление о присоединении к условиям договора' },
      },
    ]);
  userAddressFindAll.mockResolvedValue([]);
  innFindAll.mockResolvedValue([{ user_id: 'ref-1', number: '132612908997' }]);
  taxationFindAll.mockResolvedValue([
    {
      user_id: 'ref-1',
      TaxationType: { alias: 'NPD', name: 'Налог на профессиональный доход' },
    },
  ]);
  bankAccountFindAll.mockResolvedValue([validBankAccount()]);

  const result = await closingService.previewClosingDocuments('tour-1', {
    accrual_ids: ['acc-1'],
  });

  expect(result.ready_groups).toHaveLength(0);
  expect(result.blocked_groups).toHaveLength(1);
  expect(result.blocked_groups[0].issues).toContain('missing_referee_address');
  expect(result.blocked_groups[0].contract_snapshot).toEqual(
    expect.objectContaining({
      document_id: 'contract-1',
      number: '26.03/1024',
    })
  );
});

test('preview blocks act creation when referee bank account is missing', async () => {
  tournamentFindByPk.mockResolvedValue({
    id: 'tour-1',
    name: 'Кубок Москвы',
  });
  closingProfileFindOne.mockResolvedValue({
    id: 'profile-1',
    organizer_inn: '7708046206',
    organizer_name: 'Федерация хоккея Москвы',
    organizer_address: 'Москва',
  });
  accrualStatusFindOne.mockResolvedValue({ id: 'status-accrued' });
  accrualFindAll.mockResolvedValue([
    {
      id: 'acc-1',
      referee_id: 'ref-1',
      document_status_id: 'status-accrued',
      accrual_number: 'A-001',
      match_date_snapshot: '2026-03-01',
      fare_code_snapshot: 'RPOT',
      total_amount_rub: '1500.00',
      base_amount_rub: '1500.00',
      meal_amount_rub: '0.00',
      travel_amount_rub: '0.00',
      Referee: {
        id: 'ref-1',
        email: 'judge@example.com',
        last_name: 'Судья',
        first_name: 'Иван',
        patronymic: 'Иванович',
      },
      RefereeRole: { name: 'Главный судья' },
      Tournament: { name: 'Кубок Москвы' },
      TournamentGroup: null,
      Ground: null,
      Match: {
        HomeTeam: { name: 'Команда А' },
        AwayTeam: { name: 'Команда Б' },
      },
      ClosingItem: null,
    },
  ]);
  userSignTypeFindAll
    .mockResolvedValueOnce([
      {
        User: {
          id: 'fhmo-1',
          email: 'fhmo@example.com',
          last_name: 'Дробот',
          first_name: 'Алексей',
          patronymic: 'Андреевич',
          Roles: [
            {
              alias: 'FHMO_JUDGING_LEAD_SPECIALIST',
              name: 'Ведущий специалист по судейству',
              departmentName: 'Судейский департамент',
              displayOrder: 1,
            },
          ],
        },
      },
    ])
    .mockResolvedValueOnce([
      {
        user_id: 'ref-1',
        SignType: { alias: 'SIMPLE_ELECTRONIC', name: 'ПЭП' },
      },
    ]);
  documentFindAll
    .mockResolvedValueOnce([{ recipient_id: 'ref-1' }])
    .mockResolvedValueOnce([
      {
        id: 'contract-1',
        recipient_id: 'ref-1',
        number: '26.03/1024',
        document_date: '2026-03-12',
        name: 'Заявление о присоединении',
        DocumentType: { name: 'Заявление о присоединении' },
      },
    ]);
  userAddressFindAll.mockResolvedValue([
    {
      user_id: 'ref-1',
      Address: {
        result: 'г. Москва, ул. Тестовая, д. 1',
        postal_code: '109000',
      },
      AddressType: { alias: 'REGISTRATION' },
    },
  ]);
  innFindAll.mockResolvedValue([{ user_id: 'ref-1', number: '132612908997' }]);
  taxationFindAll.mockResolvedValue([
    {
      user_id: 'ref-1',
      TaxationType: { alias: 'NPD', name: 'Налог на профессиональный доход' },
    },
  ]);
  bankAccountFindAll.mockResolvedValue([]);

  const result = await closingService.previewClosingDocuments('tour-1', {
    accrual_ids: ['acc-1'],
  });

  expect(result.ready_groups).toHaveLength(0);
  expect(result.blocked_groups).toHaveLength(1);
  expect(result.blocked_groups[0].issues).toContain(
    'missing_referee_bank_account'
  );
  expect(result.blocked_groups[0].performer_snapshot?.bank_account).toBeNull();
});

test('preview supports filtered selection mode', async () => {
  accrualFindAndCountAll.mockResolvedValue({
    rows: [
      {
        id: 'acc-1',
        total_amount_rub: '1500.00',
      },
    ],
    count: 1,
  });
  tournamentFindByPk.mockResolvedValue({
    id: 'tour-1',
    name: 'Кубок Москвы',
  });
  closingProfileFindOne.mockResolvedValue({
    id: 'profile-1',
    organizer_inn: '7708046206',
    organizer_name: 'Федерация хоккея Москвы',
    organizer_address: 'Москва',
  });
  accrualStatusFindOne.mockResolvedValue({ id: 'status-accrued' });
  accrualFindAll.mockResolvedValue([
    {
      id: 'acc-1',
      referee_id: 'ref-1',
      document_status_id: 'status-accrued',
      accrual_number: 'A-001',
      match_date_snapshot: '2026-03-01',
      fare_code_snapshot: 'RPOT',
      total_amount_rub: '1500.00',
      base_amount_rub: '1500.00',
      meal_amount_rub: '0.00',
      travel_amount_rub: '0.00',
      Referee: {
        id: 'ref-1',
        email: 'judge@example.com',
        last_name: 'Судья',
        first_name: 'Иван',
        patronymic: 'Иванович',
      },
      RefereeRole: { name: 'Главный судья' },
      Tournament: { name: 'Кубок Москвы' },
      TournamentGroup: null,
      Ground: null,
      Match: {
        date_start: '2026-03-01T12:00:00.000Z',
        HomeTeam: { name: 'Команда А' },
        AwayTeam: { name: 'Команда Б' },
      },
      ClosingItem: null,
    },
  ]);
  userSignTypeFindAll
    .mockResolvedValueOnce([
      {
        User: {
          id: 'fhmo-1',
          email: 'fhmo@example.com',
          last_name: 'Дробот',
          first_name: 'Алексей',
          patronymic: 'Андреевич',
          Roles: [
            {
              alias: 'FHMO_JUDGING_LEAD_SPECIALIST',
              name: 'Ведущий специалист по судейству',
              departmentName: 'Судейский департамент',
              displayOrder: 1,
            },
          ],
        },
      },
    ])
    .mockResolvedValueOnce([
      {
        user_id: 'ref-1',
        SignType: { alias: 'SIMPLE_ELECTRONIC', name: 'ПЭП' },
      },
    ]);
  documentFindAll
    .mockResolvedValueOnce([{ recipient_id: 'ref-1' }])
    .mockResolvedValueOnce([
      {
        id: 'contract-1',
        recipient_id: 'ref-1',
        number: '26.03/1024',
        document_date: '2026-03-12',
        name: 'Заявление о присоединении',
        DocumentType: { name: 'Заявление о присоединении' },
      },
    ]);
  userAddressFindAll.mockResolvedValue([
    {
      user_id: 'ref-1',
      Address: {
        result: 'г. Москва, ул. Тестовая, д. 1',
        postal_code: '109000',
      },
      AddressType: { alias: 'REGISTRATION' },
    },
  ]);
  innFindAll.mockResolvedValue([{ user_id: 'ref-1', number: '132612908997' }]);
  taxationFindAll.mockResolvedValue([
    {
      user_id: 'ref-1',
      TaxationType: { alias: 'NPD', name: 'Налог на профессиональный доход' },
    },
  ]);
  bankAccountFindAll.mockResolvedValue([validBankAccount()]);

  const result = await closingService.previewClosingDocuments('tour-1', {
    selection_mode: 'filtered',
    filters: {
      search: 'Иванов',
      date_from: '2026-03-01',
      date_to: '2026-03-31',
    },
  });

  expect(accrualFindAndCountAll).toHaveBeenCalledWith(
    expect.objectContaining({
      attributes: ['id', 'total_amount_rub'],
      limit: 1000,
      offset: 0,
    })
  );
  expect(result.summary).toEqual(
    expect.objectContaining({
      selection_mode: 'filtered',
      selected_total: 1,
      selected_amount_rub: '1500.00',
    })
  );
  expect(result.ready_groups[0].performer_snapshot?.bank_account).toEqual(
    expect.objectContaining({
      number: '40702810900000005555',
      bic: '044525225',
      bank_name: 'ПАО Сбербанк',
    })
  );
});

test('preview reuses referee draft and preserves existing items while formatting time in MSK', async () => {
  tournamentFindByPk.mockResolvedValue({
    id: 'tour-1',
    name: 'Кубок Москвы',
  });
  closingProfileFindOne.mockResolvedValue({
    id: 'profile-1',
    organizer_inn: '7708046206',
    organizer_name: 'Федерация хоккея Москвы',
    organizer_address: 'Москва',
  });
  accrualStatusFindOne.mockResolvedValue({ id: 'status-accrued' });
  accrualFindAll
    .mockResolvedValueOnce([
      {
        id: 'acc-1',
        referee_id: 'ref-1',
        document_status_id: 'status-accrued',
        accrual_number: 'A-001',
        match_date_snapshot: '2026-03-01',
        fare_code_snapshot: 'RPOT',
        total_amount_rub: '1500.00',
        base_amount_rub: '1500.00',
        meal_amount_rub: '0.00',
        travel_amount_rub: '0.00',
        Referee: {
          id: 'ref-1',
          email: 'judge@example.com',
          last_name: 'Судья',
          first_name: 'Иван',
          patronymic: 'Иванович',
        },
        RefereeRole: { name: 'Главный судья' },
        Tournament: { name: 'Кубок Москвы' },
        TournamentGroup: null,
        Ground: null,
        Match: {
          date_start: '2026-03-01T12:00:00.000Z',
          HomeTeam: { name: 'Команда А' },
          AwayTeam: { name: 'Команда Б' },
        },
        ClosingItem: null,
      },
    ])
    .mockResolvedValueOnce([
      {
        id: 'acc-old',
        referee_id: 'ref-1',
        document_status_id: 'status-accrued',
        accrual_number: 'A-000',
        match_date_snapshot: '2026-02-28',
        fare_code_snapshot: 'RPOT',
        total_amount_rub: '1100.00',
        base_amount_rub: '1100.00',
        meal_amount_rub: '0.00',
        travel_amount_rub: '0.00',
        Referee: {
          id: 'ref-1',
          email: 'judge@example.com',
          last_name: 'Судья',
          first_name: 'Иван',
          patronymic: 'Иванович',
        },
        RefereeRole: { name: 'Главный судья' },
        Tournament: { name: 'Кубок Москвы' },
        TournamentGroup: null,
        Ground: null,
        Match: {
          date_start: '2026-02-28T15:00:00.000Z',
          HomeTeam: { name: 'Команда С' },
          AwayTeam: { name: 'Команда D' },
        },
        ClosingItem: null,
      },
    ]);
  closingDocumentFindAll.mockResolvedValue([
    {
      id: 'closing-1',
      referee_id: 'ref-1',
      status: 'DRAFT',
      Items: [
        {
          line_no: 1,
          accrual_document_id: 'acc-old',
          snapshot_json: {
            accrual_id: 'acc-old',
            service_datetime: '28.02.2026, 18:00',
            total_amount_rub: '900.00',
            base_amount_rub: '900.00',
            meal_amount_rub: '0.00',
            travel_amount_rub: '0.00',
          },
        },
      ],
    },
  ]);
  userSignTypeFindAll
    .mockResolvedValueOnce([
      {
        User: {
          id: 'fhmo-1',
          email: 'fhmo@example.com',
          last_name: 'Дробот',
          first_name: 'Алексей',
          patronymic: 'Андреевич',
          Roles: [
            {
              alias: 'FHMO_JUDGING_LEAD_SPECIALIST',
              name: 'Ведущий специалист по судейству',
              departmentName: 'Судейский департамент',
              displayOrder: 1,
            },
          ],
        },
      },
    ])
    .mockResolvedValueOnce([
      {
        user_id: 'ref-1',
        SignType: { alias: 'SIMPLE_ELECTRONIC', name: 'ПЭП' },
      },
    ]);
  documentFindAll
    .mockResolvedValueOnce([{ recipient_id: 'ref-1' }])
    .mockResolvedValueOnce([
      {
        id: 'contract-1',
        recipient_id: 'ref-1',
        number: '26.03/1024',
        document_date: '2026-03-12',
        name: 'Заявление о присоединении',
        DocumentType: { name: 'Заявление о присоединении' },
      },
    ]);
  userAddressFindAll.mockResolvedValue([
    {
      user_id: 'ref-1',
      Address: {
        result: 'г. Москва, ул. Тестовая, д. 1',
        postal_code: '109000',
      },
      AddressType: { alias: 'REGISTRATION' },
    },
  ]);
  innFindAll.mockResolvedValue([{ user_id: 'ref-1', number: '132612908997' }]);
  taxationFindAll.mockResolvedValue([
    {
      user_id: 'ref-1',
      TaxationType: { alias: 'NPD', name: 'Налог на профессиональный доход' },
    },
  ]);
  bankAccountFindAll.mockResolvedValue([validBankAccount()]);

  const result = await closingService.previewClosingDocuments('tour-1', {
    accrual_ids: ['acc-1'],
  });

  expect(result.blocked_groups).toHaveLength(0);
  expect(result.ready_groups).toHaveLength(1);
  expect(result.ready_groups[0]).toEqual(
    expect.objectContaining({
      draft_document_id: 'closing-1',
      will_update_draft: true,
    })
  );
  expect(result.ready_groups[0].items).toEqual([
    expect.objectContaining({
      accrual_id: 'acc-old',
      service_datetime: '28.02.2026, 18:00',
      total_amount_rub: '1100.00',
    }),
    expect.objectContaining({
      accrual_id: 'acc-1',
      service_datetime: expect.stringContaining('15:00'),
    }),
  ]);
  expect(result.ready_groups[0].totals).toEqual(
    expect.objectContaining({
      items_count: 2,
      total_amount_rub: '2600.00',
    })
  );
});

test('delete removes draft closing act and returns accruals to accrued status', async () => {
  accrualStatusFindOne.mockResolvedValue({ id: 'status-accrued' });
  documentUserSignFindOne.mockResolvedValue(null);
  const documentDestroy = jest.fn().mockResolvedValue({});
  const documentUpdate = jest.fn().mockResolvedValue({});
  const actUpdate = jest.fn().mockResolvedValue({});
  const actDestroy = jest.fn().mockResolvedValue({});
  closingDocumentFindOne.mockResolvedValue({
    id: 'closing-1',
    tournament_id: 'tour-1',
    referee_id: 'ref-1',
    document_id: 'doc-1',
    status: 'AWAITING_SIGNATURE',
    get: jest.fn().mockReturnValue({
      id: 'closing-1',
      status: 'AWAITING_SIGNATURE',
    }),
    update: actUpdate,
    destroy: actDestroy,
    Document: {
      id: 'doc-1',
      file_id: 'file-1',
      update: documentUpdate,
      destroy: documentDestroy,
    },
    Items: [{ accrual_document_id: 'acc-1' }],
  });

  const result = await closingService.deleteClosingDocument(
    'tour-1',
    'closing-1',
    'actor-1'
  );

  expect(documentUserSignFindOne).toHaveBeenCalledWith({
    where: { document_id: 'doc-1', user_id: 'ref-1' },
    attributes: ['id'],
  });
  expect(refereeAccrualUpdate).toHaveBeenCalled();
  expect(refereeAccrualUpdate.mock.calls[0]?.[0]).toEqual(
    expect.objectContaining({
      document_status_id: 'status-accrued',
      updated_by: 'actor-1',
    })
  );
  expect(refereeAccrualUpdate.mock.calls[0]?.[1]?.where?.id).toBeDefined();
  expect(closingItemDestroy).toHaveBeenCalled();
  expect(documentDestroy).toHaveBeenCalled();
  expect(actUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      deleted_by: 'actor-1',
      updated_by: 'actor-1',
    }),
    expect.objectContaining({ silent: true })
  );
  expect(actDestroy).toHaveBeenCalled();
  expect(removeFile).toHaveBeenCalledWith('file-1');
  expect(result).toEqual({ deleted: true, id: 'closing-1' });
});

test('delete returns success even if file cleanup fails after commit', async () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});
  accrualStatusFindOne.mockResolvedValue({ id: 'status-accrued' });
  documentUserSignFindOne.mockResolvedValue(null);
  const documentDestroy = jest.fn().mockResolvedValue({});
  const documentUpdate = jest.fn().mockResolvedValue({});
  const actUpdate = jest.fn().mockResolvedValue({});
  const actDestroy = jest.fn().mockResolvedValue({});
  closingDocumentFindOne.mockResolvedValue({
    id: 'closing-1',
    tournament_id: 'tour-1',
    referee_id: 'ref-1',
    document_id: 'doc-1',
    status: 'AWAITING_SIGNATURE',
    get: jest.fn().mockReturnValue({
      id: 'closing-1',
      status: 'AWAITING_SIGNATURE',
    }),
    update: actUpdate,
    destroy: actDestroy,
    Document: {
      id: 'doc-1',
      file_id: 'file-1',
      update: documentUpdate,
      destroy: documentDestroy,
    },
    Items: [{ accrual_document_id: 'acc-1' }],
  });
  removeFile.mockRejectedValueOnce(new Error('s3 cleanup failed'));

  const result = await closingService.deleteClosingDocument(
    'tour-1',
    'closing-1',
    'actor-1'
  );

  expect(result).toEqual({ deleted: true, id: 'closing-1' });
  expect(documentDestroy).toHaveBeenCalled();
  expect(actDestroy).toHaveBeenCalled();
  expect(removeFile).toHaveBeenCalledWith('file-1');
  consoleErrorSpy.mockRestore();
});

test('cancel keeps item snapshots readable while freeing accruals', async () => {
  tournamentFindByPk.mockResolvedValue({
    id: 'tour-1',
    name: 'Кубок Москвы',
  });
  documentStatusFindOne.mockResolvedValue({ id: 'doc-status-canceled' });
  accrualStatusFindOne.mockResolvedValue({ id: 'status-accrued' });
  const documentUpdate = jest.fn().mockResolvedValue({});
  const actUpdate = jest.fn().mockResolvedValue({});
  closingDocumentFindOne.mockResolvedValueOnce({
    id: 'closing-1',
    tournament_id: 'tour-1',
    status: 'AWAITING_SIGNATURE',
    get: jest.fn().mockReturnValue({
      id: 'closing-1',
      status: 'AWAITING_SIGNATURE',
    }),
    update: actUpdate,
    Document: {
      id: 'doc-1',
      update: documentUpdate,
    },
    Items: [{ id: 'item-1', accrual_document_id: 'acc-1' }],
  });
  closingDocumentFindAndCountAll.mockResolvedValue({
    rows: [
      {
        id: 'closing-1',
        status: 'CANCELED',
        canceled_at: new Date('2026-03-13T12:00:00Z'),
        posted_at: null,
        sent_at: null,
        document_id: 'doc-1',
        referee_id: 'ref-1',
        totals_json: { total_amount_rub: '1500.00' },
        customer_snapshot_json: null,
        performer_snapshot_json: null,
        contract_snapshot_json: null,
        fhmo_signer_snapshot_json: null,
        Tournament: { id: 'tour-1', name: 'Кубок Москвы' },
        Referee: {
          id: 'ref-1',
          email: 'judge@example.com',
          last_name: 'Судья',
          first_name: 'Иван',
          patronymic: 'Иванович',
        },
        Document: {
          id: 'doc-1',
          number: '26.03/1111',
          name: 'Акт',
          document_date: '2026-03-13',
          DocumentStatus: { alias: 'CANCELED', name: 'Отменен' },
          File: null,
          DocumentUserSigns: [],
        },
        Items: [
          {
            snapshot_json: {
              accrual_id: 'acc-1',
              service_name: 'Матч 1',
              total_amount_rub: '1500.00',
            },
          },
        ],
      },
    ],
    count: 1,
  });

  const result = await closingService.cancelClosingDocument(
    'tour-1',
    'closing-1',
    'actor-1'
  );

  expect(closingItemUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      accrual_document_id: null,
      updated_by: 'actor-1',
    }),
    expect.objectContaining({
      where: { closing_document_id: 'closing-1' },
      paranoid: false,
    })
  );
  expect(closingItemDestroy).not.toHaveBeenCalled();
  expect(result.document.items).toEqual([
    expect.objectContaining({
      accrual_id: 'acc-1',
      service_name: 'Матч 1',
    }),
  ]);
});

test('single send enqueues an async closing document job', async () => {
  tournamentFindByPk.mockResolvedValue({
    id: 'tour-1',
    name: 'Кубок Москвы',
  });
  mockFhmoSigner();
  createAsyncJob.mockResolvedValueOnce({
    job_id: 'job-send-1',
    job_type: 'REFEREE_CLOSING_DOCUMENTS',
    operation: 'SEND_TO_SIGNATURE',
    status: 'QUEUED',
    total_count: 1,
    processed_count: 0,
    success_count: 0,
    skipped_count: 0,
    failure_count: 0,
  });

  const result = await closingService.sendClosingDocument(
    'tour-1',
    'closing-1',
    'actor-1'
  );

  expect(result).toEqual(
    expect.objectContaining({
      job_id: 'job-send-1',
      operation: 'SEND_TO_SIGNATURE',
      status: 'QUEUED',
      total_count: 1,
    })
  );
  expect(createAsyncJob).toHaveBeenCalledWith(
    expect.objectContaining({
      jobType: 'REFEREE_CLOSING_DOCUMENTS',
      operation: 'SEND_TO_SIGNATURE',
      queue: 'documents',
      scopeType: 'TOURNAMENT',
      scopeId: 'tour-1',
      requestedByUserId: 'actor-1',
      items: [
        expect.objectContaining({
          item_type: 'REFEREE_CLOSING_SEND',
          target_type: 'REFEREE_CLOSING_DOCUMENT',
          target_id: 'closing-1',
          target_ref_json: expect.objectContaining({
            closing_document_id: 'closing-1',
          }),
        }),
      ],
    })
  );
  expect(documentServiceSign).not.toHaveBeenCalled();
  expect(documentServiceRegenerate).not.toHaveBeenCalled();
});

test('batch send enqueues filtered draft ids without full send processing', async () => {
  tournamentFindByPk.mockResolvedValue({
    id: 'tour-1',
    name: 'Кубок Москвы',
  });
  mockFhmoSigner();
  closingDocumentFindAndCountAll.mockResolvedValueOnce({
    rows: [
      { id: 'closing-1', status: 'DRAFT', pdf_status: 'READY' },
      { id: 'closing-2', status: 'DRAFT', pdf_status: 'READY' },
    ],
    count: 2,
  });
  createAsyncJob.mockResolvedValueOnce({
    job_id: 'job-send-2',
    job_type: 'REFEREE_CLOSING_DOCUMENTS',
    operation: 'SEND_TO_SIGNATURE',
    status: 'QUEUED',
    total_count: 2,
    processed_count: 0,
    success_count: 0,
    skipped_count: 0,
    failure_count: 0,
  });

  const result = await closingService.sendClosingDocumentsBatch(
    'tour-1',
    {
      selection_mode: 'filtered',
      filters: { status: 'DRAFT', search: 'Судья' },
    },
    'actor-1'
  );

  expect(result).toEqual(
    expect.objectContaining({
      job_id: 'job-send-2',
      operation: 'SEND_TO_SIGNATURE',
      status: 'QUEUED',
      total_count: 2,
    })
  );
  expect(closingDocumentFindAndCountAll.mock.calls[0]?.[0]).toEqual(
    expect.objectContaining({
      attributes: ['id', 'status', 'pdf_status'],
      limit: 1000,
      offset: 0,
    })
  );
  expect(createAsyncJob).toHaveBeenCalledWith(
    expect.objectContaining({
      items: [
        expect.objectContaining({ target_id: 'closing-1' }),
        expect.objectContaining({ target_id: 'closing-2' }),
      ],
    })
  );
  expect(documentServiceSign).not.toHaveBeenCalled();
});

test('send job restores draft state when external send step fails', async () => {
  mockFhmoSigner();
  documentStatusFindOne.mockResolvedValue({
    id: 'doc-status-awaiting',
    alias: 'AWAITING_SIGNATURE',
  });
  accrualStatusFindOne.mockResolvedValue({
    id: 'accrual-status-awaiting',
    alias: 'AWAITING_SIGNATURE',
  });
  documentUserSignFindOne.mockResolvedValue(null);
  closingItemFindAll.mockResolvedValue([
    { accrual_document_id: 'accrual-doc-1' },
  ]);
  documentServiceSign.mockResolvedValue({});
  documentServiceRegenerate.mockRejectedValue(
    Object.assign(new Error('storage failed'), {
      code: 'document_regenerate_failed',
    })
  );

  const act = {
    id: 'closing-1',
    document_id: 'doc-1',
    status: 'DRAFT',
    pdf_status: 'READY',
    fhmo_signer_snapshot_json: null,
    Document: {
      id: 'doc-1',
      status_id: 'doc-status-created',
      file_id: 'file-1',
      DocumentStatus: { alias: 'CREATED' },
    },
    get: jest.fn(() => ({
      id: act.id,
      document_id: act.document_id,
      status: act.status,
      pdf_status: act.pdf_status,
      fhmo_signer_snapshot_json: act.fhmo_signer_snapshot_json,
    })),
    update: jest.fn(async (values) => {
      Object.assign(act, values);
      return act;
    }),
  };
  closingDocumentFindOne.mockResolvedValue(act);

  const handler = getRegisteredClosingJobHandler('SEND_TO_SIGNATURE');
  await expect(
    handler.processItem({
      job: {
        id: 'job-1',
        scope_id: 'tour-1',
        requested_by_user_id: 'actor-1',
        payload_json: {},
      },
      item: {
        id: 'item-1',
        target_id: 'closing-1',
        target_ref_json: { closing_document_id: 'closing-1' },
        payload_json: {},
      },
    })
  ).rejects.toMatchObject({ code: 'closing_document_pdf_failed' });

  expect(documentServiceSign).toHaveBeenCalledWith(
    { id: 'fhmo-1', token_version: 1 },
    'doc-1',
    { notify: false }
  );
  expect(documentServiceRegenerate).toHaveBeenCalledWith('doc-1', 'fhmo-1');
  expect(act.update).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ status: 'SENDING', updated_by: 'actor-1' }),
    expect.objectContaining({ returning: false })
  );
  expect(act.update).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      status: 'DRAFT',
      fhmo_signer_snapshot_json: null,
      updated_by: 'actor-1',
    }),
    expect.objectContaining({ returning: false })
  );
  expect(accountingAuditCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      action: 'SEND_ROLLBACK',
      entity_id: 'closing-1',
      actor_id: 'actor-1',
    }),
    expect.any(Object)
  );
});

test('list closing tournaments excludes draft-linked accrued rows from ready count', async () => {
  tournamentFindAll.mockResolvedValue([
    {
      id: 'tour-1',
      name: 'Кубок Москвы',
      ClosingProfile: { id: 'profile-1', organizer_inn: '7708046206' },
    },
  ]);
  accrualFindAll.mockResolvedValue([
    {
      id: 'acc-free',
      tournament_id: 'tour-1',
      total_amount_rub: '1500.00',
      DocumentStatus: { alias: 'ACCRUED' },
      ClosingItem: null,
    },
    {
      id: 'acc-linked',
      tournament_id: 'tour-1',
      total_amount_rub: '1700.00',
      DocumentStatus: { alias: 'ACCRUED' },
      ClosingItem: {
        ClosingDocument: {
          id: 'closing-1',
          status: 'DRAFT',
        },
      },
    },
  ]);
  closingDocumentFindAll.mockResolvedValue([
    { id: 'closing-1', tournament_id: 'tour-1', status: 'DRAFT' },
  ]);
  userSignTypeFindAll.mockResolvedValue([
    {
      User: {
        id: 'fhmo-1',
        email: 'fhmo@example.com',
        last_name: 'Дробот',
        first_name: 'Алексей',
        patronymic: 'Андреевич',
        Roles: [
          {
            alias: 'FHMO_JUDGING_LEAD_SPECIALIST',
            name: 'Ведущий специалист по судейству',
            departmentName: 'Отдел организации судейства',
            displayOrder: 1,
          },
        ],
      },
    },
  ]);

  const result = await closingService.listClosingTournaments();

  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]).toEqual(
    expect.objectContaining({
      ready_accruals: 1,
      draft_act_count: 1,
    })
  );
});
