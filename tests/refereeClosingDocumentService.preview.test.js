import { beforeEach, expect, jest, test } from '@jest/globals';

const tournamentFindByPk = jest.fn();
const tournamentFindAll = jest.fn();
const closingProfileFindOne = jest.fn();
const closingDocumentCreate = jest.fn();
const closingDocumentFindOne = jest.fn();
const closingDocumentFindAll = jest.fn();
const closingDocumentFindAndCountAll = jest.fn();
const closingDocumentCount = jest.fn();
const accrualStatusFindOne = jest.fn();
const accrualFindAll = jest.fn();
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
const userAddressFindAll = jest.fn();
const refereeAccrualUpdate = jest.fn();
const closingItemDestroy = jest.fn();
const closingItemCreate = jest.fn();
const saveGeneratedPdf = jest.fn();
const getDownloadUrl = jest.fn();
const removeFile = jest.fn();
const sequelizeTransaction = jest.fn();
const listRefereeAccrualDocuments = jest.fn();
const documentServiceRegenerate = jest.fn();
const documentServiceSign = jest.fn();

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
    destroy: closingItemDestroy,
    create: closingItemCreate,
  },
  Address: {},
  AddressType: {},
  Inn: { findAll: innFindAll },
  Taxation: { findAll: taxationFindAll },
  TaxationType: {},
  UserAddress: { findAll: userAddressFindAll },
  AccountingAuditEvent: { create: jest.fn() },
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

jest.unstable_mockModule('../src/services/documentService.js', () => ({
  __esModule: true,
  default: {
    regenerate: documentServiceRegenerate,
    sign: documentServiceSign,
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
  userAddressFindAll.mockReset();
  closingDocumentFindOne.mockReset();
  closingDocumentFindAll.mockReset();
  closingDocumentFindAndCountAll.mockReset();
  closingDocumentCount.mockReset();
  refereeAccrualUpdate.mockReset();
  closingItemDestroy.mockReset();
  closingItemCreate.mockReset();
  saveGeneratedPdf.mockReset();
  getDownloadUrl.mockReset();
  removeFile.mockReset();
  sequelizeTransaction.mockReset();
  listRefereeAccrualDocuments.mockReset();
  documentServiceRegenerate.mockReset();
  documentServiceSign.mockReset();
  sequelizeTransaction.mockImplementation(async (callback) => callback({}));
  closingDocumentFindAndCountAll.mockResolvedValue({ rows: [], count: 0 });
  closingDocumentCount.mockResolvedValue(0);
});

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

test('preview supports filtered selection mode', async () => {
  listRefereeAccrualDocuments.mockResolvedValue({
    rows: [
      {
        id: 'acc-1',
      },
    ],
    count: 1,
    summary: { total_amount_rub: '1500.00' },
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

  const result = await closingService.previewClosingDocuments('tour-1', {
    selection_mode: 'filtered',
    filters: {
      search: 'Иванов',
      date_from: '2026-03-01',
      date_to: '2026-03-31',
    },
  });

  expect(listRefereeAccrualDocuments).toHaveBeenCalledWith(
    expect.objectContaining({
      tournamentId: 'tour-1',
      status: 'ACCRUED',
      search: 'Иванов',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
    })
  );
  expect(result.summary).toEqual(
    expect.objectContaining({
      selection_mode: 'filtered',
      selected_total: 1,
      selected_amount_rub: '1500.00',
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

test('create rolls back draft artifacts when regenerate fails after commit', async () => {
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
  documentTypeFindOne.mockResolvedValue({ id: 'doc-type-1' });
  documentStatusFindOne.mockResolvedValue({ id: 'doc-status-created' });
  signTypeFindOne.mockResolvedValue({ id: 'sign-type-1' });
  saveGeneratedPdf.mockResolvedValue({ id: 'placeholder-file-1' });
  const documentUpdate = jest.fn().mockResolvedValue({});
  const documentDestroy = jest.fn().mockResolvedValue({});
  documentCreate.mockResolvedValue({
    id: 'doc-1',
    update: documentUpdate,
  });
  const actUpdate = jest.fn().mockResolvedValue({});
  const actDestroy = jest.fn().mockResolvedValue({});
  closingDocumentCreate.mockResolvedValue({
    id: 'closing-1',
    update: actUpdate,
    destroy: actDestroy,
    get: jest.fn().mockReturnValue({ id: 'closing-1', status: 'DRAFT' }),
  });
  closingItemCreate.mockResolvedValue({});
  closingDocumentFindOne.mockResolvedValue({
    id: 'closing-1',
    document_id: 'doc-1',
    update: actUpdate,
    destroy: actDestroy,
    Document: {
      id: 'doc-1',
      file_id: 'placeholder-file-1',
      update: documentUpdate,
      destroy: documentDestroy,
    },
  });
  documentServiceRegenerate.mockRejectedValue(new Error('s3 down'));

  await expect(
    closingService.createClosingDocuments(
      'tour-1',
      { accrual_ids: ['acc-1'] },
      'actor-1'
    )
  ).rejects.toThrow('s3 down');

  expect(documentServiceRegenerate).toHaveBeenCalledWith('doc-1', 'actor-1');
  expect(closingItemDestroy).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { closing_document_id: 'closing-1' },
    })
  );
  expect(documentDestroy).toHaveBeenCalled();
  expect(actUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      deleted_by: 'actor-1',
      updated_by: 'actor-1',
    }),
    expect.objectContaining({ silent: true })
  );
  expect(actDestroy).toHaveBeenCalled();
  expect(removeFile).toHaveBeenCalledWith('placeholder-file-1');
});

test('create rolls back earlier draft acts when a later group fails', async () => {
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
        email: 'judge1@example.com',
        last_name: 'Судья',
        first_name: 'Иван',
        patronymic: 'Первый',
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
    {
      id: 'acc-2',
      referee_id: 'ref-2',
      document_status_id: 'status-accrued',
      accrual_number: 'A-002',
      match_date_snapshot: '2026-03-02',
      fare_code_snapshot: 'RPOT',
      total_amount_rub: '1700.00',
      base_amount_rub: '1700.00',
      meal_amount_rub: '0.00',
      travel_amount_rub: '0.00',
      Referee: {
        id: 'ref-2',
        email: 'judge2@example.com',
        last_name: 'Судья',
        first_name: 'Петр',
        patronymic: 'Второй',
      },
      RefereeRole: { name: 'Судья' },
      Tournament: { name: 'Кубок Москвы' },
      TournamentGroup: null,
      Ground: null,
      Match: {
        date_start: '2026-03-02T12:00:00.000Z',
        HomeTeam: { name: 'Команда В' },
        AwayTeam: { name: 'Команда Г' },
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
      {
        user_id: 'ref-2',
        SignType: { alias: 'SIMPLE_ELECTRONIC', name: 'ПЭП' },
      },
    ]);
  documentFindAll
    .mockResolvedValueOnce([
      { recipient_id: 'ref-1' },
      { recipient_id: 'ref-2' },
    ])
    .mockResolvedValueOnce([
      {
        id: 'contract-1',
        recipient_id: 'ref-1',
        number: '26.03/1024',
        document_date: '2026-03-12',
        name: 'Заявление о присоединении',
        DocumentType: { name: 'Заявление о присоединении' },
      },
      {
        id: 'contract-2',
        recipient_id: 'ref-2',
        number: '26.03/1025',
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
    {
      user_id: 'ref-2',
      Address: {
        result: 'г. Москва, ул. Тестовая, д. 2',
        postal_code: '109001',
      },
      AddressType: { alias: 'REGISTRATION' },
    },
  ]);
  innFindAll.mockResolvedValue([
    { user_id: 'ref-1', number: '132612908997' },
    { user_id: 'ref-2', number: '132612908998' },
  ]);
  taxationFindAll.mockResolvedValue([
    {
      user_id: 'ref-1',
      TaxationType: { alias: 'NPD', name: 'Налог на профессиональный доход' },
    },
    {
      user_id: 'ref-2',
      TaxationType: { alias: 'NPD', name: 'Налог на профессиональный доход' },
    },
  ]);
  documentTypeFindOne.mockResolvedValue({ id: 'doc-type-1' });
  documentStatusFindOne.mockResolvedValue({ id: 'doc-status-created' });
  signTypeFindOne.mockResolvedValue({ id: 'sign-type-1' });
  saveGeneratedPdf
    .mockResolvedValueOnce({ id: 'placeholder-file-1' })
    .mockResolvedValueOnce({ id: 'placeholder-file-2' });

  const documentUpdate1 = jest.fn().mockResolvedValue({});
  const documentDestroy1 = jest.fn().mockResolvedValue({});
  const documentUpdate2 = jest.fn().mockResolvedValue({});
  const documentDestroy2 = jest.fn().mockResolvedValue({});
  documentCreate
    .mockResolvedValueOnce({
      id: 'doc-1',
      update: documentUpdate1,
    })
    .mockResolvedValueOnce({
      id: 'doc-2',
      update: documentUpdate2,
    });
  const actUpdate1 = jest.fn().mockResolvedValue({});
  const actDestroy1 = jest.fn().mockResolvedValue({});
  const actUpdate2 = jest.fn().mockResolvedValue({});
  const actDestroy2 = jest.fn().mockResolvedValue({});
  closingDocumentCreate
    .mockResolvedValueOnce({
      id: 'closing-1',
      update: actUpdate1,
      destroy: actDestroy1,
      get: jest.fn().mockReturnValue({ id: 'closing-1', status: 'DRAFT' }),
    })
    .mockResolvedValueOnce({
      id: 'closing-2',
      update: actUpdate2,
      destroy: actDestroy2,
      get: jest.fn().mockReturnValue({ id: 'closing-2', status: 'DRAFT' }),
    });
  closingItemCreate.mockResolvedValue({});
  closingDocumentFindOne
    .mockResolvedValueOnce({
      id: 'closing-2',
      document_id: 'doc-2',
      update: actUpdate2,
      destroy: actDestroy2,
      Document: {
        id: 'doc-2',
        file_id: 'placeholder-file-2',
        update: documentUpdate2,
        destroy: documentDestroy2,
      },
    })
    .mockResolvedValueOnce({
      id: 'closing-1',
      document_id: 'doc-1',
      update: actUpdate1,
      destroy: actDestroy1,
      Document: {
        id: 'doc-1',
        file_id: 'placeholder-file-1',
        update: documentUpdate1,
        destroy: documentDestroy1,
      },
    });
  documentServiceRegenerate
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(new Error('s3 down on second act'));

  await expect(
    closingService.createClosingDocuments(
      'tour-1',
      { accrual_ids: ['acc-1', 'acc-2'] },
      'actor-1'
    )
  ).rejects.toThrow('s3 down on second act');

  expect(documentDestroy2).toHaveBeenCalled();
  expect(documentDestroy1).toHaveBeenCalled();
  expect(actDestroy2).toHaveBeenCalled();
  expect(actDestroy1).toHaveBeenCalled();
  expect(removeFile).toHaveBeenCalledWith('placeholder-file-2');
  expect(removeFile).toHaveBeenCalledWith('placeholder-file-1');
});

test('send rolls act back to draft when signer-side regeneration fails', async () => {
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
  documentStatusFindOne.mockImplementation(async ({ where: { alias } }) => ({
    id: `doc-status-${String(alias).toLowerCase()}`,
  }));
  accrualStatusFindOne.mockImplementation(async ({ where: { alias } }) => ({
    id: `accrual-status-${String(alias).toLowerCase()}`,
  }));
  const documentUpdate = jest.fn().mockResolvedValue({});
  const actUpdate = jest.fn().mockResolvedValue({});
  const act = {
    id: 'closing-1',
    document_id: 'doc-1',
    status: 'DRAFT',
    sent_at: null,
    fhmo_signer_snapshot_json: { name: 'Старый подписант' },
    get: jest.fn().mockReturnValue({
      id: 'closing-1',
      status: 'DRAFT',
    }),
    update: actUpdate,
    Document: {
      id: 'doc-1',
      status_id: 'doc-status-created',
      update: documentUpdate,
      DocumentStatus: { alias: 'CREATED', name: 'Создан' },
    },
    Items: [{ accrual_document_id: 'acc-1' }],
  };
  closingDocumentFindOne.mockResolvedValueOnce(act).mockResolvedValueOnce({
    ...act,
    Document: {
      id: 'doc-1',
      status_id: 'doc-status-awaiting_signature',
      update: documentUpdate,
    },
  });
  documentServiceSign.mockResolvedValue(undefined);
  documentServiceRegenerate
    .mockRejectedValueOnce(new Error('smtp-or-s3 failure'))
    .mockResolvedValueOnce({});

  await expect(
    closingService.sendClosingDocument('tour-1', 'closing-1', 'actor-1')
  ).rejects.toThrow('smtp-or-s3 failure');

  expect(documentServiceSign).toHaveBeenCalledWith(
    { id: 'fhmo-1', token_version: 1 },
    'doc-1'
  );
  expect(documentUserSignDestroy).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        document_id: 'doc-1',
        user_id: 'fhmo-1',
      },
    })
  );
  expect(documentUpdate).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      status_id: 'doc-status-awaiting_signature',
      updated_by: 'actor-1',
    }),
    expect.objectContaining({ returning: false })
  );
  expect(documentUpdate).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      status_id: 'doc-status-created',
      updated_by: 'actor-1',
    }),
    expect.objectContaining({ returning: false })
  );
  expect(actUpdate).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      status: 'AWAITING_SIGNATURE',
      updated_by: 'actor-1',
    }),
    expect.objectContaining({ returning: false })
  );
  expect(actUpdate).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      status: 'DRAFT',
      sent_at: null,
      fhmo_signer_snapshot_json: { name: 'Старый подписант' },
      updated_by: 'actor-1',
    }),
    expect.objectContaining({ returning: false })
  );
  expect(refereeAccrualUpdate).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      document_status_id: 'accrual-status-awaiting_signature',
      updated_by: 'actor-1',
    }),
    expect.objectContaining({
      where: {
        id: expect.any(Object),
      },
    })
  );
  expect(refereeAccrualUpdate).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      document_status_id: 'accrual-status-accrued',
      updated_by: 'actor-1',
    }),
    expect.objectContaining({
      where: {
        id: expect.any(Object),
      },
    })
  );
  expect(documentServiceRegenerate).toHaveBeenNthCalledWith(
    1,
    'doc-1',
    'fhmo-1'
  );
  expect(documentServiceRegenerate).toHaveBeenNthCalledWith(
    2,
    'doc-1',
    'actor-1'
  );
});

test('batch send supports explicit selection of draft acts', async () => {
  tournamentFindByPk.mockResolvedValue({
    id: 'tour-1',
    name: 'Кубок Москвы',
  });
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
  documentStatusFindOne.mockImplementation(async ({ where: { alias } }) => ({
    id: `doc-status-${String(alias).toLowerCase()}`,
  }));
  accrualStatusFindOne.mockImplementation(async ({ where: { alias } }) => ({
    id: `accrual-status-${String(alias).toLowerCase()}`,
  }));
  const documentUpdate = jest.fn().mockResolvedValue({});
  const buildAct = (id, documentId, accrualId) => ({
    id,
    document_id: documentId,
    status: 'DRAFT',
    sent_at: null,
    fhmo_signer_snapshot_json: null,
    referee_id: `ref-${id}`,
    get: jest.fn().mockReturnValue({
      id,
      status: 'DRAFT',
    }),
    update: jest.fn().mockResolvedValue({}),
    Document: {
      id: documentId,
      status_id: 'doc-status-created',
      update: documentUpdate,
      DocumentStatus: { alias: 'CREATED', name: 'Создан' },
    },
    Items: [{ accrual_document_id: accrualId }],
  });

  closingDocumentFindOne
    .mockResolvedValueOnce(buildAct('closing-1', 'doc-1', 'acc-1'))
    .mockResolvedValueOnce(buildAct('closing-2', 'doc-2', 'acc-2'));
  documentServiceSign.mockResolvedValue(undefined);
  documentServiceRegenerate.mockResolvedValue(undefined);
  closingDocumentFindAndCountAll.mockResolvedValue({
    rows: [
      {
        id: 'closing-1',
        status: 'AWAITING_SIGNATURE',
        sent_at: new Date('2026-03-13T12:00:00Z'),
        posted_at: null,
        canceled_at: null,
        referee_id: 'ref-closing-1',
        totals_json: { total_amount_rub: '3100.00' },
        customer_snapshot_json: null,
        performer_snapshot_json: null,
        contract_snapshot_json: null,
        fhmo_signer_snapshot_json: null,
        Tournament: { id: 'tour-1', name: 'Кубок Москвы' },
        Referee: {
          id: 'ref-closing-1',
          email: 'judge1@example.com',
          last_name: 'Судья',
          first_name: 'Один',
          patronymic: 'Тестовый',
        },
        Document: {
          id: 'doc-1',
          number: '26.03/2001',
          name: 'Акт об оказании услуг',
          document_date: '2026-03-13',
          DocumentStatus: {
            alias: 'AWAITING_SIGNATURE',
            name: 'Ожидает подписания',
          },
          File: null,
          DocumentUserSigns: [],
        },
        Items: [],
      },
      {
        id: 'closing-2',
        status: 'AWAITING_SIGNATURE',
        sent_at: new Date('2026-03-13T12:05:00Z'),
        posted_at: null,
        canceled_at: null,
        referee_id: 'ref-closing-2',
        totals_json: { total_amount_rub: '4200.00' },
        customer_snapshot_json: null,
        performer_snapshot_json: null,
        contract_snapshot_json: null,
        fhmo_signer_snapshot_json: null,
        Tournament: { id: 'tour-1', name: 'Кубок Москвы' },
        Referee: {
          id: 'ref-closing-2',
          email: 'judge2@example.com',
          last_name: 'Судья',
          first_name: 'Два',
          patronymic: 'Тестовый',
        },
        Document: {
          id: 'doc-2',
          number: '26.03/2002',
          name: 'Акт об оказании услуг',
          document_date: '2026-03-13',
          DocumentStatus: {
            alias: 'AWAITING_SIGNATURE',
            name: 'Ожидает подписания',
          },
          File: null,
          DocumentUserSigns: [],
        },
        Items: [],
      },
    ],
    count: 2,
  });

  const result = await closingService.sendClosingDocumentsBatch(
    'tour-1',
    {
      selection_mode: 'explicit',
      closing_document_ids: ['closing-1', 'closing-2'],
    },
    'actor-1'
  );

  expect(documentServiceSign).toHaveBeenCalledTimes(2);
  expect(documentServiceRegenerate).toHaveBeenCalledTimes(2);
  expect(result.summary).toEqual(
    expect.objectContaining({
      selected_total: 2,
      sent_total: 2,
      failed_total: 0,
    })
  );
  expect(result.failures).toEqual([]);
  expect(result.documents).toHaveLength(2);
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
