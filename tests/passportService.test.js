import { expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Passport: { findOne: findOneMock },
  DocumentType: {},
  Country: {},
}));

const { default: service } = await import('../src/services/passportService.js');

test('getByUser calls model with associations', async () => {
  const pass = { id: 'p1' };
  findOneMock.mockResolvedValue(pass);
  const res = await service.getByUser('u1');
  expect(res).toBe(pass);
  expect(findOneMock).toHaveBeenCalledWith({
    where: { user_id: 'u1' },
    include: [{}, {}],
  });
});
