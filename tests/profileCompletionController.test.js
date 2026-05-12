import { beforeEach, expect, jest, test } from '@jest/globals';

const setStatusMock = jest.fn();

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: { setStatus: setStatusMock },
}));

const { default: controller } =
  await import('../src/controllers/profileCompletionController.js');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

beforeEach(() => {
  setStatusMock.mockReset();
});

test('setStep rejects non-registration status aliases', async () => {
  const req = { body: { status: 'ACTIVE' }, user: { id: 'u1' } };
  const res = makeRes();

  await controller.setStep(req, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'invalid_profile_status' });
  expect(setStatusMock).not.toHaveBeenCalled();
});

test('complete rejects activation outside registration flow', async () => {
  const req = {
    user: {
      id: 'u1',
      getUserStatus: jest.fn().mockResolvedValue({ alias: 'INACTIVE' }),
    },
  };
  const res = makeRes();

  await controller.complete(req, res);

  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith({
    error: 'invalid_profile_transition',
  });
  expect(setStatusMock).not.toHaveBeenCalled();
});

test('complete allows activation from a registration step', async () => {
  const req = {
    user: {
      id: 'u1',
      getUserStatus: jest
        .fn()
        .mockResolvedValue({ alias: 'REGISTRATION_STEP_3' }),
    },
  };
  const res = makeRes();
  setStatusMock.mockResolvedValue({ id: 'u1' });

  await controller.complete(req, res);

  expect(setStatusMock).toHaveBeenCalledWith('u1', 'ACTIVE', 'u1');
  expect(res.json).toHaveBeenCalledWith({
    user: { id: 'u1', status: 'ACTIVE' },
  });
});
