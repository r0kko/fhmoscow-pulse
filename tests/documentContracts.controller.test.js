import { expect, jest, test } from '@jest/globals';

const listJudgesMock = jest.fn();
const precheckMock = jest.fn();

jest.unstable_mockModule('../src/services/documentContractService.js', () => ({
  __esModule: true,
  default: {
    listJudges: (...args) => listJudgesMock(...args),
    precheck: (...args) => precheckMock(...args),
  },
}));

const controller = (
  await import('../src/controllers/documentContractAdminController.js')
).default;

test('controller.listJudges returns judges array', async () => {
  const judges = [
    {
      id: 'u1',
      lastName: 'Иванов',
      firstName: 'Иван',
      patronymic: 'Иванович',
      birthDate: '1990-01-02',
      signType: { id: 's1', name: 'КЭП', alias: 'KONTUR_SIGN' },
    },
  ];
  listJudgesMock.mockResolvedValueOnce(judges);

  let captured;
  const res = { json: (p) => (captured = p) };
  await controller.listJudges({}, res);
  expect(captured.judges).toEqual(judges);
  expect(listJudgesMock).toHaveBeenCalled();
});

test('controller.precheck returns precheck data', async () => {
  const payload = { precheck: { user: { id: 'u1' }, checks: { ok: true } } };
  precheckMock.mockResolvedValueOnce(payload.precheck);

  let captured;
  const res = { json: (p) => (captured = p) };
  const req = { params: { id: 'u1' } };
  await controller.precheck(req, res);
  expect(captured).toEqual(payload);
  expect(precheckMock).toHaveBeenCalledWith('u1');
});

test('controller.precheck returns 404 when user not found', async () => {
  precheckMock.mockResolvedValueOnce(null);

  let statusCode;
  let captured;
  const res = {
    status: (s) => {
      statusCode = s;
      return res;
    },
    json: (p) => (captured = p),
  };
  const req = { params: { id: 'missing' } };
  await controller.precheck(req, res);
  expect(statusCode).toBe(404);
  expect(captured).toEqual({ error: 'user_not_found' });
});
