import { expect, jest, test } from '@jest/globals';

const removeMock = jest.fn();

jest.unstable_mockModule('../src/services/bankAccountService.js', () => ({
  __esModule: true,
  default: { removeForUser: removeMock },
}));

const { default: controller } = await import(
  '../src/controllers/bankAccountSelfController.js'
);

test('remove deletes bank account and returns 204', async () => {
  removeMock.mockResolvedValue(undefined);
  const req = { user: { id: 'u1' } };
  const res = { status: jest.fn().mockReturnThis(), end: jest.fn() };
  await controller.remove(req, res);
  expect(removeMock).toHaveBeenCalledWith('u1', 'u1');
  expect(res.status).toHaveBeenCalledWith(204);
  expect(res.end).toHaveBeenCalled();
});

test('remove returns 404 with error when service throws', async () => {
  removeMock.mockRejectedValue(new Error('notfound'));
  const req = { user: { id: 'u2' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.remove(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ error: 'notfound' });
});
