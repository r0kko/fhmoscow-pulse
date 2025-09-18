import { beforeEach, expect, jest, test } from '@jest/globals';

const listJudgesMock = jest.fn();
const precheckMock = jest.fn();
const createContractDocMock = jest.fn();
const sendErrorMock = jest.fn();

beforeEach(() => {
  listJudgesMock.mockReset();
  precheckMock.mockReset();
  createContractDocMock.mockReset();
  sendErrorMock.mockReset().mockReturnValue('error');
});

jest.unstable_mockModule('../src/services/documentContractService.js', () => ({
  __esModule: true,
  default: {
    listJudges: (...args) => listJudgesMock(...args),
    precheck: (...args) => precheckMock(...args),
  },
}));

jest.unstable_mockModule('../src/services/documentService.js', () => ({
  __esModule: true,
  default: {
    createContractApplicationDocument: (...args) =>
      createContractDocMock(...args),
  },
}));

jest.unstable_mockModule('../src/utils/api.js', () => ({
  __esModule: true,
  sendError: (...args) => sendErrorMock(...args),
}));

const controller = (
  await import('../src/controllers/documentContractAdminController.js')
).default;

function createRes() {
  let statusCode = 200;
  let payload;
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      payload = data;
      return data;
    },
    set: jest.fn(),
  };
  return {
    res,
    getStatus: () => statusCode,
    getPayload: () => payload,
  };
}

test('controller.listJudges returns judges array', async () => {
  const judges = [{ id: 'u1', lastName: 'Иванов' }];
  listJudgesMock.mockResolvedValueOnce(judges);
  const { res, getPayload } = createRes();
  await controller.listJudges({}, res);
  expect(getPayload()).toEqual({ judges });
  expect(listJudgesMock).toHaveBeenCalledTimes(1);
  expect(sendErrorMock).not.toHaveBeenCalled();
});

test('controller.listJudges passes errors to sendError', async () => {
  const err = new Error('boom');
  listJudgesMock.mockRejectedValueOnce(err);
  const { res } = createRes();
  await controller.listJudges({}, res);
  expect(sendErrorMock).toHaveBeenCalledWith(res, err);
});

test('controller.precheck returns precheck data', async () => {
  const pre = { user: { id: 'u1' }, checks: { ok: true } };
  precheckMock.mockResolvedValueOnce(pre);
  const { res, getPayload } = createRes();
  await controller.precheck({ params: { id: 'u1' } }, res);
  expect(getPayload()).toEqual({ precheck: pre });
  expect(precheckMock).toHaveBeenCalledWith('u1');
});

test('controller.precheck returns 404 when user not found', async () => {
  precheckMock.mockResolvedValueOnce(null);
  const { res, getStatus, getPayload } = createRes();
  await controller.precheck({ params: { id: 'missing' } }, res);
  expect(getStatus()).toBe(404);
  expect(getPayload()).toEqual({ error: 'user_not_found' });
});

test('controller.precheck delegates unexpected errors to sendError', async () => {
  const err = Object.assign(new Error('fail'), { code: 'fail' });
  precheckMock.mockRejectedValueOnce(err);
  const { res } = createRes();
  await controller.precheck({ params: { id: 'u1' } }, res);
  expect(sendErrorMock).toHaveBeenCalledWith(res, err);
});

test('generateApplication returns contract payload when checks pass', async () => {
  const pre = {
    user: { id: 'u1' },
    checks: {
      ageOk: true,
      simpleESign: { has: true },
      taxation: { isNotPerson: true },
      documents: { all: true },
    },
  };
  const result = { id: 'doc123' };
  precheckMock.mockResolvedValueOnce(pre);
  createContractDocMock.mockResolvedValueOnce(result);

  const { res, getPayload } = createRes();
  const req = { params: { id: 'u1' }, user: { id: 'staff1' } };
  await controller.generateApplication(req, res);

  expect(createContractDocMock).toHaveBeenCalledWith('u1', 'staff1');
  expect(getPayload()).toEqual(result);
  expect(sendErrorMock).not.toHaveBeenCalled();
});

test('generateApplication returns 404 when precheck missing', async () => {
  precheckMock.mockResolvedValueOnce(null);
  const { res, getStatus, getPayload } = createRes();
  await controller.generateApplication(
    { params: { id: 'missing' }, user: { id: 'staff' } },
    res
  );
  expect(getStatus()).toBe(404);
  expect(getPayload()).toEqual({ error: 'user_not_found' });
  expect(createContractDocMock).not.toHaveBeenCalled();
});

test('generateApplication rejects when checks fail', async () => {
  const pre = {
    checks: {
      ageOk: false,
      simpleESign: { has: false },
      taxation: { isNotPerson: true },
      documents: { all: true },
    },
  };
  precheckMock.mockResolvedValueOnce(pre);
  const { res, getStatus, getPayload } = createRes();
  await controller.generateApplication(
    { params: { id: 'u1' }, user: { id: 'staff' } },
    res
  );
  expect(getStatus()).toBe(400);
  expect(getPayload()).toEqual({ error: 'precheck_failed', details: pre });
  expect(createContractDocMock).not.toHaveBeenCalled();
});

test('generateApplication forwards service errors to sendError', async () => {
  const pre = {
    checks: {
      ageOk: true,
      simpleESign: { has: true },
      taxation: { isNotPerson: true },
      documents: { all: true },
    },
  };
  const err = new Error('storage failed');
  precheckMock.mockResolvedValueOnce(pre);
  createContractDocMock.mockRejectedValueOnce(err);

  const { res } = createRes();
  await controller.generateApplication(
    { params: { id: 'u1' }, user: { id: 'staff' } },
    res
  );
  expect(sendErrorMock).toHaveBeenCalledWith(res, err);
});
