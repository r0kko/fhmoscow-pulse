import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const MATCH_ID = '123e4567-e89b-12d3-a456-426614174000';
const USER_ID = '9321ab79-5c0f-4817-9992-4b42ce5c8404';

const matchFindByPkMock = jest.fn();
const snapshotFindOneMock = jest.fn();
const snapshotUpdateMock = jest.fn();
const snapshotCreateMock = jest.fn();
const userSignTypeFindAllMock = jest.fn();
const saveGeneratedPdfMock = jest.fn();
const getFileBufferMock = jest.fn();
const fetchMatchProtocolPdfMock = jest.fn();
const renderMatchProtocolPdfMock = jest.fn();
const nextMatchProtocolNumberMock = jest.fn();
const roleFindOneMock = jest.fn();
const withRedisLockMock = jest.fn(async (_key, _ttl, fn) => fn());
const transactionMock = jest.fn(async (fn) => fn());

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  File: {},
  GameStatus: {},
  Match: { findByPk: matchFindByPkMock },
  MatchProtocolSnapshot: {
    findOne: snapshotFindOneMock,
    update: snapshotUpdateMock,
    create: snapshotCreateMock,
    sequelize: { transaction: transactionMock },
  },
  Role: { findOne: roleFindOneMock },
  SignType: {},
  Team: {},
  User: {},
  UserSignType: { findAll: userSignTypeFindAllMock },
  UserStatus: {},
}));

jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: {
    saveGeneratedPdf: saveGeneratedPdfMock,
    getFileBuffer: getFileBufferMock,
  },
}));

jest.unstable_mockModule('../src/services/numberingService.js', () => ({
  __esModule: true,
  nextMatchProtocolNumber: nextMatchProtocolNumberMock,
}));

jest.unstable_mockModule('../src/services/matchProtocolClient.js', () => ({
  __esModule: true,
  fetchMatchProtocolPdf: fetchMatchProtocolPdfMock,
}));

jest.unstable_mockModule('../src/services/matchProtocolPdfService.js', () => ({
  __esModule: true,
  renderMatchProtocolPdf: renderMatchProtocolPdfMock,
}));

jest.unstable_mockModule('../src/utils/redisLock.js', () => ({
  __esModule: true,
  withRedisLock: withRedisLockMock,
  buildJobLockKey: (name) => `lock:${name}`,
}));

jest.unstable_mockModule('../src/config/matchProtocol.js', () => ({
  __esModule: true,
  MATCH_PROTOCOL_CONFIG: {
    apiBase: 'https://api.test',
    apiKey: 'icl_test.secret',
    timeoutMs: 30000,
    cacheTtlSeconds: 300,
    sealPath: '/tmp/seal.png',
    sealWhiteThreshold: 245,
  },
  isMatchProtocolConfigured: () => true,
}));

const { downloadMatchProtocol, renderHighlightedMatchProtocol } =
  await import('../src/services/matchProtocolService.js');

beforeEach(() => {
  jest.clearAllMocks();
  snapshotUpdateMock.mockResolvedValue([1]);
  nextMatchProtocolNumberMock.mockResolvedValue('26.04/1');
  roleFindOneMock.mockResolvedValue({
    alias: 'FHMO_JUDGING_LEAD_SPECIALIST',
    name: 'Ведущий специалист по судейству',
    departmentName: 'Отдел организации судейства',
  });
  saveGeneratedPdfMock.mockResolvedValue({
    id: 'file-1',
    key: 'documents/file-1.pdf',
  });
  renderMatchProtocolPdfMock.mockResolvedValue({
    buffer: Buffer.from('%PDF-1.7 rendered'),
    sealAssetHash: 'seal-hash',
    renderVersion: 1,
  });
  snapshotCreateMock.mockImplementation(async (payload) => ({
    ...payload,
    setDataValue: jest.fn(),
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('returns cached snapshot when it is still fresh', async () => {
  matchFindByPkMock.mockResolvedValue({
    id: 'match-1',
    external_id: 77,
    GameStatus: { alias: 'FINISHED' },
  });
  snapshotFindOneMock.mockResolvedValue({
    id: 'snapshot-1',
    number: '26.04/1',
    last_checked_at: new Date(Date.now() - 60_000).toISOString(),
    SignedFile: { id: 'file-1', key: 'documents/file-1.pdf' },
  });
  getFileBufferMock.mockResolvedValue(Buffer.from('%PDF-cached'));

  const result = await downloadMatchProtocol('match-1', 'admin-1', 'req-1');

  expect(fetchMatchProtocolPdfMock).not.toHaveBeenCalled();
  expect(result.buffer.toString()).toBe('%PDF-cached');
  expect(result.filename).toBe('protocol-26.04-1.pdf');
});

test('creates a new snapshot when upstream returns a newer PDF', async () => {
  matchFindByPkMock.mockResolvedValue({
    id: MATCH_ID,
    external_id: 88,
    GameStatus: { alias: 'FINISHED' },
  });
  snapshotFindOneMock.mockResolvedValue(null);
  userSignTypeFindAllMock.mockResolvedValue([
    {
      User: {
        id: USER_ID,
        last_name: 'Иванов',
        first_name: 'Иван',
        patronymic: 'Иванович',
        Roles: [
          {
            alias: 'FHMO_JUDGING_LEAD_SPECIALIST',
            name: 'Ведущий специалист по судейству',
            departmentName: 'Отдел организации судейства',
            displayOrder: 10,
          },
        ],
      },
    },
  ]);
  fetchMatchProtocolPdfMock.mockResolvedValue({
    status: 'ok',
    buffer: Buffer.from('%PDF-upstream'),
    etag: '"etag-1"',
    lastModified: new Date('2026-04-20T10:00:00.000Z'),
    filename: 'match-protocol-88.pdf',
  });

  const result = await downloadMatchProtocol(MATCH_ID, 'admin-1', 'req-2');

  expect(renderMatchProtocolPdfMock).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceBuffer: Buffer.from('%PDF-upstream'),
      matchId: MATCH_ID,
      signedByUserId: USER_ID,
    })
  );
  expect(saveGeneratedPdfMock).toHaveBeenCalled();
  expect(snapshotCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      match_id: MATCH_ID,
      external_match_id: 88,
      number: '26.04/1',
      signed_by_user_id: USER_ID,
      signed_role_alias: 'FHMO_JUDGING_LEAD_SPECIALIST',
      status: 'ACTIVE',
    }),
    expect.anything()
  );
  expect(result.filename).toBe('protocol-26.04-1.pdf');
});

test('fails when match is not finished', async () => {
  matchFindByPkMock.mockResolvedValue({
    id: 'match-1',
    external_id: 77,
    GameStatus: { alias: 'SCHEDULED' },
  });

  await expect(
    downloadMatchProtocol('match-1', 'admin-1', 'req-3')
  ).rejects.toMatchObject({
    code: 'match_protocol_requires_finished',
    status: 409,
  });
});

test('waits for ready snapshot when download lock is busy', async () => {
  jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
    fn();
    return 0;
  });
  withRedisLockMock.mockImplementationOnce(
    async (_key, _ttl, _fn, { onBusy }) => onBusy()
  );
  snapshotFindOneMock.mockResolvedValueOnce(null).mockResolvedValueOnce({
    id: 'snapshot-1',
    number: '26.04/1',
    external_match_id: 77,
    SignedFile: { id: 'file-1', key: 'documents/file-1.pdf' },
  });
  getFileBufferMock.mockResolvedValueOnce(Buffer.from('%PDF-after-wait'));

  const result = await downloadMatchProtocol('match-1', 'admin-1', 'req-4');

  expect(result.buffer.toString()).toBe('%PDF-after-wait');
  expect(result.filename).toBe('protocol-26.04-1.pdf');
});

test('renders highlighted protocol without replacing official snapshot', async () => {
  matchFindByPkMock.mockResolvedValue({
    id: MATCH_ID,
    external_id: 88,
    GameStatus: { alias: 'FINISHED' },
  });
  snapshotFindOneMock
    .mockResolvedValueOnce({
      id: 'snapshot-1',
      number: '26.04/1',
      signed_at: new Date('2026-04-20T10:00:00.000Z'),
      signed_by_user_id: USER_ID,
      signed_role_alias: 'FHMO_JUDGING_LEAD_SPECIALIST',
      last_checked_at: new Date(Date.now() - 60_000).toISOString(),
      SignedFile: { id: 'file-1', key: 'documents/file-1.pdf' },
    })
    .mockResolvedValueOnce({
      id: 'snapshot-1',
      number: '26.04/1',
      signed_at: new Date('2026-04-20T10:00:00.000Z'),
      signed_by_user_id: USER_ID,
      signed_role_alias: 'FHMO_JUDGING_LEAD_SPECIALIST',
      SignedFile: { id: 'file-1', key: 'documents/file-1.pdf' },
      SignedBy: {
        id: USER_ID,
        last_name: 'Иванов',
        first_name: 'Иван',
        patronymic: 'Иванович',
      },
    });
  getFileBufferMock.mockResolvedValue(Buffer.from('%PDF-official'));
  fetchMatchProtocolPdfMock.mockResolvedValue({
    status: 'ok',
    buffer: Buffer.from('%PDF-highlighted'),
    filename: 'highlighted.pdf',
  });

  const result = await renderHighlightedMatchProtocol(MATCH_ID, {
    actorId: 'admin-1',
    requestId: 'req-highlight',
    highlightPlayerIds: [101, 102],
  });

  expect(fetchMatchProtocolPdfMock).toHaveBeenCalledTimes(1);
  expect(fetchMatchProtocolPdfMock).toHaveBeenCalledWith(88, {
    requestId: 'req-highlight',
    highlightPlayerIds: [101, 102],
  });
  expect(renderMatchProtocolPdfMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      sourceBuffer: Buffer.from('%PDF-highlighted'),
      matchId: MATCH_ID,
      snapshotId: 'snapshot-1',
      documentNumber: '26.04/1',
      signedByUserId: USER_ID,
    })
  );
  expect(saveGeneratedPdfMock).not.toHaveBeenCalled();
  expect(snapshotUpdateMock).not.toHaveBeenCalled();
  expect(snapshotCreateMock).not.toHaveBeenCalled();
  expect(result.filename).toBe('highlighted.pdf');
});
