import { beforeEach, expect, jest, test } from '@jest/globals';

const downloadMatchProtocolMock = jest.fn();
const resolveMatchAccessContextMock = jest.fn();
const ensureParticipantOrThrowMock = jest.fn((context) => {
  if (!context?.isHome && !context?.isAway) {
    const err = new Error('forbidden_not_match_member');
    err.code = 'forbidden_not_match_member';
    err.status = 403;
    throw err;
  }
});

jest.unstable_mockModule('../src/services/matchProtocolService.js', () => ({
  __esModule: true,
  default: { downloadMatchProtocol: downloadMatchProtocolMock },
}));

jest.unstable_mockModule('../src/utils/matchAccess.js', () => ({
  __esModule: true,
  resolveMatchAccessContext: resolveMatchAccessContextMock,
  ensureParticipantOrThrow: ensureParticipantOrThrowMock,
}));

const { default: controller } =
  await import('../src/controllers/matchProtocolController.js');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
    end: jest.fn(),
  };
}

beforeEach(() => {
  downloadMatchProtocolMock.mockReset();
  resolveMatchAccessContextMock.mockReset();
  ensureParticipantOrThrowMock.mockClear();
});

test('download rejects non-admin users outside both match teams', async () => {
  const req = { params: { id: 'm1' }, user: { id: 'u1' } };
  const res = makeRes();
  resolveMatchAccessContextMock.mockResolvedValue({
    isAdmin: false,
    isHome: false,
    isAway: false,
    match: { team1_id: 'h', team2_id: 'a' },
  });

  await controller.download(req, res);

  expect(downloadMatchProtocolMock).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ error: 'forbidden_not_match_member' })
  );
});

test('download allows match participant', async () => {
  const req = { params: { id: 'm1' }, user: { id: 'u1' }, id: 'req1' };
  const res = makeRes();
  resolveMatchAccessContextMock.mockResolvedValue({
    isAdmin: false,
    isHome: true,
    isAway: false,
    match: { team1_id: 'h', team2_id: 'a' },
  });
  downloadMatchProtocolMock.mockResolvedValue({
    filename: 'protocol.pdf',
    buffer: Buffer.from('pdf'),
  });

  await controller.download(req, res);

  expect(downloadMatchProtocolMock).toHaveBeenCalledWith('m1', 'u1', 'req1');
  expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
  expect(res.end).toHaveBeenCalledWith(Buffer.from('pdf'));
});
