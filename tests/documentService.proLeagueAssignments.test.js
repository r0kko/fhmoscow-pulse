import { beforeEach, expect, jest, test } from '@jest/globals';

const matchFindByPkMock = jest.fn();
const matchRefereeStatusFindAllMock = jest.fn();
const matchRefereeFindAllMock = jest.fn();
const matchRefereeDraftClearFindAllMock = jest.fn();
const vehicleFindAllMock = jest.fn();

const documentCreateMock = jest.fn();
const documentFindAllMock = jest.fn();
const documentFindByPkMock = jest.fn();
const documentTypeFindOneMock = jest.fn();
const documentTypeCreateMock = jest.fn();
const documentStatusFindOneMock = jest.fn();
const userSignTypeFindAllMock = jest.fn();
const userSignTypeFindOneMock = jest.fn();
const documentUserSignCountMock = jest.fn();
const documentUserSignFindOneMock = jest.fn();
const documentUserSignCreateMock = jest.fn();
const userFindByPkMock = jest.fn();

const saveGeneratedPdfMock = jest.fn();
const removeFileMock = jest.fn();
const getDownloadUrlMock = jest.fn();

const sendAwaitingSignatureEmailMock = jest.fn();
const sendSignedEmailMock = jest.fn();

const buildProLeagueSheetPdfMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Document: {
    create: documentCreateMock,
    findAll: documentFindAllMock,
    findByPk: documentFindByPkMock,
    findOne: jest.fn(),
  },
  DocumentType: {
    findOne: documentTypeFindOneMock,
    create: documentTypeCreateMock,
    findByPk: jest.fn(),
  },
  SignType: { findOne: jest.fn(), findByPk: jest.fn() },
  File: {},
  DocumentUserSign: {
    count: documentUserSignCountMock,
    findOne: documentUserSignFindOneMock,
    create: documentUserSignCreateMock,
  },
  UserSignType: {
    findAll: userSignTypeFindAllMock,
    findOne: userSignTypeFindOneMock,
    destroy: jest.fn(),
    create: jest.fn(),
  },
  DocumentStatus: { findOne: documentStatusFindOneMock },
  User: { findByPk: userFindByPkMock },
  Match: { findByPk: matchFindByPkMock },
  Tournament: {},
  CompetitionType: {},
  Team: {},
  Ground: {},
  Address: {},
  MatchRefereeStatus: { findAll: matchRefereeStatusFindAllMock },
  MatchReferee: { findAll: matchRefereeFindAllMock },
  MatchRefereeDraftClear: { findAll: matchRefereeDraftClearFindAllMock },
  RefereeRole: {},
  RefereeRoleGroup: {},
  Vehicle: { findAll: vehicleFindAllMock },
  Role: {},
  UserStatus: {},
  MedicalCertificate: {},
  MedicalCertificateFile: {},
  MedicalCertificateType: {},
}));

jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: {
    saveGeneratedPdf: saveGeneratedPdfMock,
    removeFile: removeFileMock,
    getDownloadUrl: getDownloadUrlMock,
    uploadDocument: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendDocumentAwaitingSignatureEmail: sendAwaitingSignatureEmailMock,
    sendDocumentSignedEmail: sendSignedEmailMock,
    sendDocumentCreatedEmail: jest.fn(),
  },
}));

jest.unstable_mockModule(
  '../src/services/docBuilders/proLeagueRefereeAssignmentsSheet.js',
  () => ({
    __esModule: true,
    default: buildProLeagueSheetPdfMock,
  })
);

jest.unstable_mockModule(
  '../src/services/docBuilders/bankDetailsChange.js',
  () => ({
    __esModule: true,
    default: jest.fn(),
  })
);

jest.unstable_mockModule(
  '../src/services/docBuilders/equipmentTransfer.js',
  () => ({
    __esModule: true,
    default: jest.fn(),
  })
);

const { default: documentService } =
  await import('../src/services/documentService.js');

function makeSigner({
  id,
  email,
  alias,
  roleName,
  signCreatedDate = '2026-01-01T00:00:00.000Z',
}) {
  return {
    sign_created_date: new Date(signCreatedDate),
    sign_type_id: 'sign-simple',
    SignType: {
      id: 'sign-simple',
      alias: 'SIMPLE_ELECTRONIC',
      name: 'Простая электронная подпись',
    },
    User: {
      id,
      email,
      last_name: `Фамилия-${id}`,
      first_name: `Имя-${id}`,
      patronymic: `Отчество-${id}`,
      Roles: [
        {
          alias,
          name: roleName,
          departmentName: 'Отдел организации судейства',
          displayOrder: 1,
        },
      ],
      UserStatus: { alias: 'ACTIVE' },
    },
  };
}

beforeEach(() => {
  matchFindByPkMock.mockReset();
  matchRefereeStatusFindAllMock.mockReset();
  matchRefereeFindAllMock.mockReset();
  matchRefereeDraftClearFindAllMock.mockReset();
  vehicleFindAllMock.mockReset();
  documentCreateMock.mockReset();
  documentFindAllMock.mockReset();
  documentFindByPkMock.mockReset();
  documentTypeFindOneMock.mockReset();
  documentTypeCreateMock.mockReset();
  documentStatusFindOneMock.mockReset();
  userSignTypeFindAllMock.mockReset();
  userSignTypeFindOneMock.mockReset();
  documentUserSignCountMock.mockReset();
  documentUserSignFindOneMock.mockReset();
  documentUserSignCreateMock.mockReset();
  userFindByPkMock.mockReset();
  saveGeneratedPdfMock.mockReset();
  removeFileMock.mockReset();
  getDownloadUrlMock.mockReset();
  sendAwaitingSignatureEmailMock.mockReset();
  sendSignedEmailMock.mockReset();
  buildProLeagueSheetPdfMock.mockReset();

  matchFindByPkMock.mockResolvedValue({
    id: 'm1',
    date_start: new Date('2026-02-20T12:00:00.000Z'),
    Tournament: {
      id: 't1',
      name: 'Кубок',
      full_name: 'Кубок',
      CompetitionType: { id: 'ct-pro', alias: 'PRO', name: 'Профессиональные' },
    },
    HomeTeam: { id: 'team1', name: 'Команда 1' },
    AwayTeam: { id: 'team2', name: 'Команда 2' },
    Ground: { id: 'g1', name: 'Арена', Address: { result: 'ул. Ледовая, 1' } },
  });

  matchRefereeStatusFindAllMock.mockResolvedValue([
    { id: 'status-draft', alias: 'DRAFT' },
    { id: 'status-published', alias: 'PUBLISHED' },
    { id: 'status-confirmed', alias: 'CONFIRMED' },
  ]);

  matchRefereeFindAllMock.mockResolvedValue([
    {
      MatchRefereeStatus: { alias: 'CONFIRMED' },
      RefereeRole: {
        id: 'role1',
        name: 'Главный судья',
        sort_order: 1,
        referee_role_group_id: 'group1',
        RefereeRoleGroup: { id: 'group1', name: 'Судьи в поле', sort_order: 1 },
      },
      User: {
        id: 'u-ref',
        last_name: 'Судейский',
        first_name: 'Судья',
        patronymic: 'Главный',
      },
    },
  ]);

  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);
  vehicleFindAllMock.mockResolvedValue([]);
  documentTypeFindOneMock.mockResolvedValue({
    id: 'doc-type-pro',
    name: 'Лист назначений судей на матч',
    alias: 'PRO_LEAGUE_MATCH_REFEREE_ASSIGNMENTS_SHEET',
    generated: true,
  });
  documentFindAllMock.mockResolvedValue([]);
  documentStatusFindOneMock.mockImplementation(({ where }) => {
    if (where.alias === 'AWAITING_SIGNATURE') {
      return Promise.resolve({
        id: 'status-awaiting',
        name: 'Ожидает подписания',
        alias: 'AWAITING_SIGNATURE',
      });
    }
    if (where.alias === 'SIGNED') {
      return Promise.resolve({
        id: 'status-signed',
        name: 'Подписан',
        alias: 'SIGNED',
      });
    }
    return Promise.resolve(null);
  });

  saveGeneratedPdfMock.mockResolvedValueOnce({ id: 'file-initial' });
  saveGeneratedPdfMock.mockResolvedValueOnce({ id: 'file-signed' });
  getDownloadUrlMock.mockResolvedValue('https://example.com/signed.pdf');

  documentCreateMock.mockResolvedValue({
    id: 'doc-created',
    file_id: 'file-initial',
  });

  const signDocUpdateMock = jest.fn().mockResolvedValue({});
  const regenerateDocUpdateMock = jest.fn().mockResolvedValue({});

  documentFindByPkMock
    .mockResolvedValueOnce({
      id: 'doc-created',
      sign_type_id: 'sign-simple',
      recipient_id: 'u-head',
      document_type_id: 'doc-type-pro',
      DocumentStatus: { alias: 'AWAITING_SIGNATURE' },
      SignType: { alias: 'SIMPLE_ELECTRONIC' },
      update: signDocUpdateMock,
      number: '26.02/1',
    })
    .mockResolvedValueOnce({
      id: 'doc-created',
      name: 'Лист назначений судей на матч',
      number: '26.02/1',
      document_date: new Date('2026-02-20T12:00:00.000Z'),
      file_id: 'file-initial',
      description: JSON.stringify({
        kind: 'PRO_LEAGUE_MATCH_REFEREE_ASSIGNMENTS_SHEET',
        payload: {
          title: 'Лист назначений судей на матч',
          rows: [{ role: 'Главный судья', referee: 'Судейский Судья' }],
        },
      }),
      DocumentType: {
        alias: 'PRO_LEAGUE_MATCH_REFEREE_ASSIGNMENTS_SHEET',
        generated: true,
        name: 'Лист назначений судей на матч',
      },
      DocumentStatus: { alias: 'SIGNED' },
      recipient: {
        id: 'u-head',
        last_name: 'Глава',
        first_name: 'Отдела',
        patronymic: 'Судейства',
        Roles: [
          {
            alias: 'FHMO_JUDGING_HEAD',
            name: 'Руководитель отдела',
            departmentName: 'Отдел организации судейства',
            displayOrder: 1,
          },
        ],
      },
      update: regenerateDocUpdateMock,
    })
    .mockResolvedValueOnce({
      id: 'doc-created',
      number: '26.02/1',
      name: 'Лист назначений судей на матч',
      document_date: new Date('2026-02-20T12:00:00.000Z'),
      DocumentType: {
        name: 'Лист назначений судей на матч',
        alias: 'PRO_LEAGUE_MATCH_REFEREE_ASSIGNMENTS_SHEET',
        generated: true,
      },
      SignType: {
        name: 'Простая электронная подпись',
        alias: 'SIMPLE_ELECTRONIC',
      },
      DocumentStatus: { name: 'Подписан', alias: 'SIGNED' },
      File: { id: 'file-signed', key: 'signed.pdf' },
      recipient: {
        id: 'u-head',
        last_name: 'Глава',
        first_name: 'Отдела',
        patronymic: 'Судейства',
      },
    });

  documentUserSignCountMock.mockResolvedValue(0);
  documentUserSignFindOneMock
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({
      id: 'doc-sign-1',
      created_at: new Date('2026-02-20T12:10:00.000Z'),
    });
  documentUserSignCreateMock.mockResolvedValue({ id: 'doc-sign-1' });

  userSignTypeFindOneMock.mockResolvedValue({
    user_id: 'u-head',
    sign_type_id: 'sign-simple',
  });
  userFindByPkMock.mockResolvedValue({
    id: 'u-head',
    email: 'head@fhmoscow.test',
    last_name: 'Глава',
    first_name: 'Отдела',
    patronymic: 'Судейства',
  });
  buildProLeagueSheetPdfMock.mockResolvedValue(Buffer.from('pdf-signed'));
});

test('createProLeagueMatchRefereeAssignmentsDocument auto-selects judging head and signs document', async () => {
  userSignTypeFindAllMock.mockResolvedValue([
    makeSigner({
      id: 'u-specialist',
      email: 'specialist@fhmoscow.test',
      alias: 'FHMO_JUDGING_SPECIALIST',
      roleName: 'Специалист по судейству',
      signCreatedDate: '2026-02-20T11:00:00.000Z',
    }),
    makeSigner({
      id: 'u-head',
      email: 'head@fhmoscow.test',
      alias: 'FHMO_JUDGING_HEAD',
      roleName: 'Руководитель отдела',
      signCreatedDate: '2026-02-20T10:00:00.000Z',
    }),
  ]);

  const result =
    await documentService.createProLeagueMatchRefereeAssignmentsDocument(
      'm1',
      'admin'
    );

  expect(documentCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      recipient_id: 'u-head',
      status_id: 'status-awaiting',
      sign_type_id: 'sign-simple',
    })
  );
  expect(documentUserSignCreateMock).toHaveBeenCalled();
  expect(sendAwaitingSignatureEmailMock).not.toHaveBeenCalled();
  expect(result.document.status).toEqual(
    expect.objectContaining({ alias: 'SIGNED' })
  );
});

test('createProLeagueMatchRefereeAssignmentsDocument fails when no active judging signer with simple sign exists', async () => {
  userSignTypeFindAllMock.mockResolvedValue([]);

  await expect(
    documentService.createProLeagueMatchRefereeAssignmentsDocument(
      'm1',
      'admin'
    )
  ).rejects.toMatchObject({ code: 'federation_signer_not_found' });
});
