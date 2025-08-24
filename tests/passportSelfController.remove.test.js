import { expect, jest, test } from '@jest/globals';

const removeMock = jest.fn();

jest.unstable_mockModule('../src/services/passportService.js', () => ({
  __esModule: true,
  default: { removeByUser: removeMock },
}));

const { default: controller } = await import('../src/controllers/passportSelfController.js');

test('remove deletes passport and returns 204', async () => {
  removeMock.mockResolvedValue(undefined);
  const req = { user: { id: 'u1' } };
  const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
  await controller.remove(req, res);
  expect(removeMock).toHaveBeenCalledWith('u1', 'u1');
  expect(res.status).toHaveBeenCalledWith(204);
  expect(res.send).toHaveBeenCalled();
});

test('remove returns 404 with error when service throws', async () => {
  removeMock.mockRejectedValue(new Error('notfound'));
  const req = { user: { id: 'u2' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.remove(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ error: 'notfound' });
});

