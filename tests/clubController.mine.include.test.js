import { expect, jest, test } from '@jest/globals';

const listUserClubsMock = jest.fn().mockResolvedValue([{ id: 'c1', name: 'A' }]);

jest.unstable_mockModule('../src/services/clubUserService.js', () => ({
  __esModule: true,
  default: { listUserClubs: listUserClubsMock },
}));
jest.unstable_mockModule('../src/mappers/clubMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (c) => c },
}));

const { default: controller } = await import('../src/controllers/clubController.js');

test('mine=true uses include=teams flag when provided', async () => {
  listUserClubsMock.mockClear();
  const req = { query: { mine: 'true', include: 'teams' }, user: { id: 'u1' }, access: { isAdmin: false } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.list(req, res);
  expect(listUserClubsMock).toHaveBeenCalledWith('u1', true);
});

