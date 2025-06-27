import { expect, jest, test } from '@jest/globals';

const setStatusMock = jest.fn();
const toPublicMock = jest.fn((u) => u);

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: { setStatus: setStatusMock },
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublic: toPublicMock },
}));

const { default: controller } = await import('../src/controllers/userAdminController.js');

test('approve updates user status to ACTIVE', async () => {
  setStatusMock.mockResolvedValue({ id: '1' });
  const req = { params: { id: '1' } };
  const res = { json: jest.fn() };
  await controller.approve(req, res);
  expect(setStatusMock).toHaveBeenCalledWith('1', 'ACTIVE');
  expect(res.json).toHaveBeenCalledWith({ user: { id: '1' } });
});
